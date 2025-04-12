import http from 'k6/http'
import { sleep, check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { config, generateRandomCheckin } from './config.js'

const outboxRequests = new Counter('outbox_requests')
const successRate = new Rate('success_rate')
const outboxLatency = new Trend('outbox_latency')

export const options = {
  scenarios: {
    outbox_traffic: {
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
    outbox_latency: [`p(95)<${config.testParams.thresholds.latency}`],
    success_rate: [`rate>${config.testParams.thresholds.successRate}`],
  },
}

export function setup() {
  const createActivities = Array(20)
    .fill()
    .map((_, i) => {
      const checkin = generateRandomCheckin()
      return {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Create',
        actor: `${config.baseUrl}/users/${config.testUsers.local.username}`,
        object: {
          type: 'Note',
          content: checkin.content,
          location: {
            type: 'Place',
            name: checkin.location_name,
            latitude: checkin.latitude,
            longitude: checkin.longitude,
          },
        },
      }
    })

  return { createActivities }
}

export default function (data) {
  const activity =
    data.createActivities[
      Math.floor(Math.random() * data.createActivities.length)
    ]

  const activityToSend = Object.assign(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',

      type: 'Create',
      actor: `${config.baseUrl}/users/${config.testUsers.local.username}`,
      published: new Date().toISOString(),
      id: `${config.baseUrl}/activities/${Math.random()
        .toString(36)
        .substring(2, 15)}`,
      _test: true,
    },
    activity
  )

  const targetUser = config.testUsers.local.username

  const url = `${config.baseUrl}/users/${targetUser}/outbox`

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/activity+json',
  }

  const startTime = new Date().getTime()

  const response = http.post(url, JSON.stringify(activityToSend), { headers })

  const endTime = new Date().getTime()
  const latency = endTime - startTime

  outboxRequests.add(1)
  outboxLatency.add(latency)

  const success = check(response, {
    'status is 202': (r) => r.status === 202,
  })

  successRate.add(success ? 1 : 0)

  if (!success) {
    console.log(
      `Outbox request failed: ${response.status}, Body: ${response.body}`
    )
  }

  sleep(0.3 + Math.random() * 0.5)
}

export function teardown(data) {}
