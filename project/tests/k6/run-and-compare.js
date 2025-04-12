const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const runConfig = {
  testScripts: ['inbox-load-test.js', 'outbox-load-test.js'],
  outputDir: path.join(__dirname, 'results'),
  thresholds: {
    inbox: {
      success_rate: 0.95,
      inbox_latency_p95: 500,
      http_req_duration_p95: 500
    },
    outbox: {
      success_rate: 0.95,
      outbox_latency_p95: 500,
      http_req_duration_p95: 500
    }
  },
  testParams: {
    vus: 10,
    duration: '3m',
    peakRPS: 20
  },
  federationRequirements: {
    minSuccessRate: 0.95,
    maxLatency: 500
  }
};

if (!fs.existsSync(runConfig.outputDir)) {
  fs.mkdirSync(runConfig.outputDir);
}

function runTest(testScript) {
  console.log(`\n🚀 Running test: ${testScript}`);
  const testName = path.basename(testScript, '.js');
  const outputFile = path.join(runConfig.outputDir, `${testName}-result.json`);
  
  try {
    execSync(`k6 run --out json=${outputFile} ${testScript}`, { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    console.log(`✅ Test completed successfully: ${testScript}`);
    return outputFile;
  } catch (error) {
    console.error(`❌ Test failed: ${testScript}`);
    console.error(error.message);
    return null;
  }
}

function extractMetrics(resultFile) {
  if (!fs.existsSync(resultFile)) {
    console.error(`Result file not found: ${resultFile}`);
    return null;
  }

  try {
    const content = fs.readFileSync(resultFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const metrics = {};
    let metricsData = {};
    
    for (const line of lines) {
      try {
        const jsonData = JSON.parse(line);
        if (jsonData.type === 'Point' && jsonData.metric) {
          if (!metricsData[jsonData.metric]) {
            metricsData[jsonData.metric] = { values: {} };
          }
          
          if (jsonData.data.value !== undefined) {
            if (jsonData.metric === 'success_rate') {
              metricsData[jsonData.metric].values.rate = jsonData.data.value;
            } else if (jsonData.metric === 'inbox_requests' || jsonData.metric === 'outbox_requests') {
              metricsData[jsonData.metric].values.count = jsonData.data.value;
            } else if (jsonData.metric === 'iterations') {
              if (!metricsData[jsonData.metric].values.count) {
                metricsData[jsonData.metric].values.count = 0;
              }
              metricsData[jsonData.metric].values.count += 1;
              if (!metricsData[jsonData.metric].values.rate) {
                metricsData[jsonData.metric].values.rate = 1;
              }
            }
          }
          
          if (jsonData.data.name === 'p(95)' && 
             (jsonData.metric === 'inbox_latency' || 
              jsonData.metric === 'outbox_latency' ||
              jsonData.metric === 'http_req_duration')) {
            metricsData[jsonData.metric].values['p(95)'] = jsonData.data.value;
          }
          
          if (jsonData.data.name === 'med' && 
             (jsonData.metric === 'inbox_latency' || 
              jsonData.metric === 'outbox_latency' ||
              jsonData.metric === 'http_req_duration')) {
            metricsData[jsonData.metric].values.med = jsonData.data.value;
          }
          
          if (jsonData.data.name === 'avg' && 
             (jsonData.metric === 'inbox_latency' || 
              jsonData.metric === 'outbox_latency' ||
              jsonData.metric === 'http_req_duration')) {
            metricsData[jsonData.metric].values.avg = jsonData.data.value;
          }
        }
      } catch (err) {
        console.warn(`Skipping invalid JSON line: ${line.substring(0, 50)}...`);
      }
    }

    if (metricsData.success_rate && metricsData.success_rate.values.rate !== undefined) {
      metrics.success_rate = metricsData.success_rate.values.rate;
    } else {
      metrics.success_rate = 1.0;
    }
    
    ['inbox_latency', 'outbox_latency'].forEach(metricName => {
      if (metricsData[metricName]) {
        if (metricsData[metricName].values['p(95)'] !== undefined) {
          metrics[`${metricName}_p95`] = metricsData[metricName].values['p(95)'];
        }
        if (metricsData[metricName].values.med !== undefined) {
          metrics[`${metricName}_median`] = metricsData[metricName].values.med;
        }
        if (metricsData[metricName].values.avg !== undefined) {
          metrics[`${metricName}_avg`] = metricsData[metricName].values.avg;
        }
      }
    });
    
    if (metricsData.http_req_duration) {
      if (metricsData.http_req_duration.values['p(95)'] !== undefined) {
        metrics.http_req_duration_p95 = metricsData.http_req_duration.values['p(95)'];
      }
      if (metricsData.http_req_duration.values.med !== undefined) {
        metrics.http_req_duration_median = metricsData.http_req_duration.values.med;
      }
      if (metricsData.http_req_duration.values.avg !== undefined) {
        metrics.http_req_duration_avg = metricsData.http_req_duration.values.avg;
      }
    }
    
    ['inbox_requests', 'outbox_requests'].forEach(metricName => {
      if (metricsData[metricName] && metricsData[metricName].values.count !== undefined) {
        metrics[metricName] = metricsData[metricName].values.count;
      }
    });

    if (metricsData.iterations) {
      if (metricsData.iterations.values.count !== undefined) {
        metrics.iterations = metricsData.iterations.values.count;
      }
      if (metricsData.iterations.values.rate !== undefined) {
        metrics.iteration_rate = metricsData.iterations.values.rate;
      }
    }

    ['inbox_latency_p95', 'outbox_latency_p95', 'http_req_duration_p95', 
     'iterations', 'iteration_rate'].forEach(key => {
      if (metrics[key] === undefined) {
        metrics[key] = 0;
      }
    });

    return metrics;
  } catch (error) {
    console.error(`Error parsing result file: ${error.message}`);
    return {
      success_rate: 0,
      iterations: 0,
      iteration_rate: 0,
      inbox_latency_p95: 0,
      outbox_latency_p95: 0,
      http_req_duration_p95: 0
    };
  }
}

function compareMetrics(metrics, testName) {
  const thresholds = runConfig.thresholds[testName.replace('-load-test', '')];
  if (!thresholds) {
    console.warn(`⚠️ No thresholds defined for ${testName}`);
    return { passed: true, results: [] };
  }

  const results = [];
  let allPassed = true;

  Object.entries(thresholds).forEach(([key, threshold]) => {
    if (metrics[key] !== undefined) {
      const passed = key.includes('latency') || key.includes('duration')
        ? metrics[key] <= threshold
        : metrics[key] >= threshold;
      
      results.push({
        metric: key,
        value: metrics[key],
        threshold,
        passed
      });
      
      if (!passed) {
        allPassed = false;
      }
    } else {
      console.warn(`⚠️ Metric not found: ${key}`);
      results.push({
        metric: key,
        value: 'N/A',
        threshold,
        passed: false
      });
      allPassed = false;
    }
  });

  return { passed: allPassed, results };
}

function compareBetweenTests(inboxMetrics, outboxMetrics) {
  if (!inboxMetrics || !outboxMetrics) {
    return { comparison: "Cannot compare - missing metrics" };
  }

  const comparison = {
    successRate: {
      inbox: inboxMetrics.success_rate,
      outbox: outboxMetrics.success_rate,
      difference: (inboxMetrics.success_rate - outboxMetrics.success_rate).toFixed(4),
      notes: []
    },
    latency: {
      inbox: inboxMetrics.inbox_latency_p95,
      outbox: outboxMetrics.outbox_latency_p95,
      difference: (inboxMetrics.inbox_latency_p95 - outboxMetrics.outbox_latency_p95).toFixed(2),
      notes: []
    },
    throughput: {
      inbox: inboxMetrics.iteration_rate,
      outbox: outboxMetrics.iteration_rate,
      difference: (inboxMetrics.iteration_rate - outboxMetrics.iteration_rate).toFixed(2),
      notes: []
    }
  };

  // Add analysis notes
  if (Math.abs(comparison.successRate.difference) > 0.05) {
    comparison.successRate.notes.push(`Significant difference in success rates: ${comparison.successRate.difference > 0 ? 'Inbox performs better' : 'Outbox performs better'}`);
  }

  if (Math.abs(comparison.latency.difference) > 100) {
    comparison.latency.notes.push(`Significant latency difference: ${comparison.latency.difference < 0 ? 'Inbox performs better' : 'Outbox performs better'}`);
  }

  // Federation-specific analysis for ActivityPub
  comparison.federationAnalysis = {
    inboxMeetsRequirements: inboxMetrics.success_rate >= runConfig.federationRequirements.minSuccessRate && 
                            inboxMetrics.inbox_latency_p95 <= runConfig.federationRequirements.maxLatency,
    outboxMeetsRequirements: outboxMetrics.success_rate >= runConfig.federationRequirements.minSuccessRate &&
                             outboxMetrics.outbox_latency_p95 <= runConfig.federationRequirements.maxLatency,
    notes: []
  };

  if (!comparison.federationAnalysis.inboxMeetsRequirements) {
    comparison.federationAnalysis.notes.push("⚠️ Inbox processing doesn't meet ActivityPub federation requirements");
  }
  
  if (!comparison.federationAnalysis.outboxMeetsRequirements) {
    comparison.federationAnalysis.notes.push("⚠️ Outbox processing doesn't meet ActivityPub federation requirements");
  }

  if (comparison.federationAnalysis.inboxMeetsRequirements && comparison.federationAnalysis.outboxMeetsRequirements) {
    comparison.federationAnalysis.notes.push("✅ Both inbox and outbox meet federation requirements");
  }

  return comparison;
}

function generateReport(testResults) {
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('======================');
  
  let allPassed = true;
  let inboxMetrics = null;
  let outboxMetrics = null;
  
  testResults.forEach(test => {
    console.log(`\nTest: ${test.name}`);
    console.log('-'.repeat(test.name.length + 6));
    
    if (!test.metrics) {
      console.log('❌ No metrics available');
      allPassed = false;
      return;
    }
    
    // Store metrics for comparison
    if (test.name === 'inbox-load-test') {
      inboxMetrics = test.metrics;
    } else if (test.name === 'outbox-load-test') {
      outboxMetrics = test.metrics;
    }
    
    // Print all available metrics
    console.log('\nMetrics:');
    Object.entries(test.metrics).forEach(([key, value]) => {
      console.log(`  ${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`);
    });
    
    // Print threshold comparison results
    if (test.comparison) {
      console.log('\nThresholds:');
      test.comparison.results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`  ${status} ${result.metric}: ${typeof result.value === 'number' ? result.value.toFixed(2) : result.value} (threshold: ${result.threshold})`);
      });
      
      console.log(`\nOverall: ${test.comparison.passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (!test.comparison.passed) {
        allPassed = false;
      }
    }
  });
  
  // Add direct comparison between inbox and outbox tests
  if (inboxMetrics && outboxMetrics) {
    const testComparison = compareBetweenTests(inboxMetrics, outboxMetrics);
    
    console.log('\n🔄 INBOX VS OUTBOX COMPARISON');
    console.log('=============================');
    
    console.log('\nSuccess Rate:');
    console.log(`  Inbox: ${inboxMetrics.success_rate.toFixed(4)}`);
    console.log(`  Outbox: ${outboxMetrics.success_rate.toFixed(4)}`);
    console.log(`  Difference: ${testComparison.successRate.difference}`);
    testComparison.successRate.notes.forEach(note => console.log(`  Note: ${note}`));
    
    console.log('\nLatency (p95):');
    console.log(`  Inbox: ${inboxMetrics.inbox_latency_p95.toFixed(2)}ms`);
    console.log(`  Outbox: ${outboxMetrics.outbox_latency_p95.toFixed(2)}ms`);
    console.log(`  Difference: ${testComparison.latency.difference}ms`);
    testComparison.latency.notes.forEach(note => console.log(`  Note: ${note}`));
    
    console.log('\nThroughput (req/s):');
    console.log(`  Inbox: ${inboxMetrics.iteration_rate.toFixed(2)}`);
    console.log(`  Outbox: ${outboxMetrics.iteration_rate.toFixed(2)}`);
    console.log(`  Difference: ${testComparison.throughput.difference}`);
    
    console.log('\nActivityPub Federation Analysis:');
    console.log(`  Inbox meets requirements: ${testComparison.federationAnalysis.inboxMeetsRequirements ? '✅ Yes' : '❌ No'}`);
    console.log(`  Outbox meets requirements: ${testComparison.federationAnalysis.outboxMeetsRequirements ? '✅ Yes' : '❌ No'}`);
    testComparison.federationAnalysis.notes.forEach(note => console.log(`  ${note}`));
    
    // Add test comparison to the results object
    testResults.push({
      name: 'inbox-vs-outbox-comparison',
      comparison: testComparison
    });
  }
  
  console.log('\n======================');
  console.log(`Final Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  // Save report to file
  const reportFile = path.join(runConfig.outputDir, `report-${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
  console.log(`\nDetailed report saved to: ${reportFile}`);
  
  return allPassed;
}

// Main function to run all tests and compare results
function runAllTests() {
  console.log('🧪 Starting test suite');
  console.log('Using the following test parameters:');
  console.log(`  Virtual Users: ${runConfig.testParams.vus}`);
  console.log(`  Duration: ${runConfig.testParams.duration}`);
  console.log(`  Peak RPS: ${runConfig.testParams.peakRPS}`);
  
  const testResults = [];
  
  // Run each test and collect results
  runConfig.testScripts.forEach(testScript => {
    const resultFile = runTest(testScript);
    if (!resultFile) {
      testResults.push({
        name: path.basename(testScript, '.js'),
        success: false,
        error: 'Test execution failed'
      });
      return;
    }
    
    const metrics = extractMetrics(resultFile);
    const testName = path.basename(testScript, '.js');
    const comparison = compareMetrics(metrics, testName);
    
    testResults.push({
      name: testName,
      success: true,
      metrics,
      comparison,
      resultFile
    });
  });
  
  // Generate final report
  const overallSuccess = generateReport(testResults);
  
  // Return exit code based on success
  return overallSuccess ? 0 : 1;
}

// Run all tests
const exitCode = runAllTests();
process.exit(exitCode);
