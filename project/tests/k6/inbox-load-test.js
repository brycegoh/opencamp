import http from 'k6/http'
import { sleep, check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { config } from './config.js'

const inboxRequests = new Counter('inbox_requests')
const successRate = new Rate('success_rate')
const inboxLatency = new Trend('inbox_latency')

export const options = {
  scenarios: {
    inbox_traffic: {
      executor: config.testParams.executor,
      startRate: config.testParams.startRate,
      timeUnit: config.testParams.timeUnit,
      preAllocatedVUs: config.testParams.preAllocatedVUs,
      maxVUs: config.testParams.maxVUs,
      stages: config.testParams.stages,
    },
  },
  thresholds: {
    http_req_duration: [
      `p(95)<${config.testParams.thresholds.httpReqDuration}`,
    ],
    inbox_latency: [`p(95)<${config.testParams.thresholds.latency}`],
    success_rate: [`rate>${config.testParams.thresholds.successRate}`],
  },
}

function createFollowActivity(sourceActor, targetActor) {
  const id = `${config.baseUrl}/activities/${Math.random()
    .toString(36)
    .substring(2, 15)}`

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: id,
    type: 'Follow',
    actor: sourceActor,
    object: targetActor,
    published: new Date().toISOString(),
    _test: true,
  }
}

export default function () {
  const targetUser = config.testUsers.local.username

  const sourceActor = `${config.baseUrl}/users/${config.testUsers.local.username}`

  const targetActor = `${config.baseUrl}/users/${targetUser}`

  const activity = createFollowActivity(sourceActor, targetActor)

  const url = `${config.baseUrl}/users/${targetUser}/inbox`

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/activity+json',
  }

  console.log('Sending activity:', JSON.stringify(activity))

  const startTime = new Date().getTime()
  const response = http.post(url, JSON.stringify(activity), { headers })
  const endTime = new Date().getTime()

  inboxRequests.add(1)
  inboxLatency.add(endTime - startTime)

  const success = check(response, {
    'status is 202': (r) => r.status === 202,
  })

  successRate.add(success ? 1 : 0)

  if (!success) {
    console.log(`Request failed: ${response.status}, Body: ${response.body}`)
  }

  sleep(0.1)
}
