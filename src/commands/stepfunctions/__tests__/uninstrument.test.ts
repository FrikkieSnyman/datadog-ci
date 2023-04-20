import {DescribeStateMachineCommandOutput} from '@aws-sdk/client-sfn'
import {Cli} from 'clipanion/lib/advanced'

import {UninstrumentStepFunctionsCommand} from '../uninstrument'

import {describeStateMachineFixture} from './fixtures/aws-resources'
import {contextFixture, testContext} from './fixtures/cli'

jest.mock('../../../../package.json', () => ({version: '2.0.0'}))

describe('stepfunctions uninstrument', () => {
  let cli: Cli
  let aws: any
  let helpers: any

  beforeAll(() => {
    helpers = require('../helpers')
    helpers.applyChanges = jest.fn().mockImplementation(() => false)

    cli = new Cli()
    cli.register(UninstrumentStepFunctionsCommand)
  })

  let context: testContext
  let describeStateMachineCommandOutput: DescribeStateMachineCommandOutput

  beforeEach(() => {
    aws = require('../awsCommands')
    context = contextFixture()

    describeStateMachineCommandOutput = describeStateMachineFixture()
    aws.describeStateMachine = jest.fn().mockImplementation(() => describeStateMachineCommandOutput)

    // const subscriptionFilter = subscriptionFilterFixture()
    // aws.describeSubscriptionFilters = jest.fn().mockImplementation(() => ({subscriptionFilters: [subscriptionFilter]}))
    aws.deleteSubscriptionFilter = jest.fn().mockImplementation(() => ({}))
    aws.untagResource = jest.fn().mockImplementation(() => ({}))
  })

  describe('parameter validation', () => {
    test('errors if --step-function is not given', async () => {
      const exitCode = await cli.run(['stepfunctions', 'uninstrument'], context)

      expect(exitCode).toBe(1)
      expect(context.toString()).toMatch('[Error] must specify at least one --step-function\n')
    })

    test('removes duplicate step function arns', async () => {
      const exitCode = await cli.run(
        [
          'stepfunctions',
          'uninstrument',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction',
        ],
        context
      )
      expect(exitCode).toBe(0)
      expect(aws.describeStateMachine).toHaveBeenCalledTimes(1)
    })

    test('errors if no step function arn', async () => {
      const exitCode = await cli.run(['stepfunctions', 'uninstrument'], context)

      expect(exitCode).toBe(1)
      expect(context.toString()).toMatch('[Error] must specify at least one --step-function')
    })

    test('errors if any step function arn is invalid', async () => {
      const exitCode = await cli.run(['stepfunctions', 'uninstrument', '--step-function', 'arn:'], context)

      expect(exitCode).toBe(1)
      expect(context.toString()).toMatch('[Error] invalid arn format for --step-function')
    })
  })

  describe('step function logging disabled', () => {
    test('creates step function log group, subscribes it to forwarder, and adds it to step function logging config', async () => {
      const loggingConfiguration = {
        level: 'OFF',
        includeExecutionData: false,
      }
      const stepFunction = describeStateMachineFixture({loggingConfiguration})
      aws.describeStateMachine = jest.fn().mockImplementation(() => stepFunction)

      const exitCode = await cli.run(
        [
          'stepfunctions',
          'uninstrument',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction',
        ],
        context
      )

      expect(exitCode).toBe(1)
      expect(context.toString()).toMatch('[Error] Unable to get Log Group arn from Step Function logging configuration')
    })
  })

  describe('step function logging enabled', () => {
    test('unsubscribes log group in step function logging config from forwarder and removes dd_sls_ci tag', async () => {
      const exitCode = await cli.run(
        [
          'stepfunctions',
          'uninstrument',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction',
        ],
        context
      )

      expect(exitCode).toBe(0)
      expect(context.toString()).toMatchSnapshot()
    })
  })

  describe('aws error handling', () => {
    test('errors if unable to fetch step function', async () => {
      aws.describeStateMachine = jest.fn().mockImplementation(() => {
        throw new Error('mock describeStateMachine error')
      })

      const exitCode = await cli.run(
        [
          'stepfunctions',
          'uninstrument',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction',
        ],
        context
      )

      expect(exitCode).toBe(1)
      expect(context.toString()).toMatch(
        '[Error] mock describeStateMachine error. Unable to fetch Step Function arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction'
      )
    })

    test('errors if unable to fetch step function subscription filters', async () => {
      aws.describeSubscriptionFilters = jest.fn().mockImplementation(() => {
        throw new Error('mock describeSubscriptionFilters error')
      })

      const exitCode = await cli.run(
        [
          'stepfunctions',
          'uninstrument',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction',
        ],
        context
      )

      expect(exitCode).toBe(1)
      expect(context.toString()).toMatch(
        '[Error] mock describeSubscriptionFilters error. Unable to fetch Subscription Filter to delete for Log Group /aws/vendedlogs/states/ExampleStepFunction-Logs-test'
      )
    })

    test('all aws commands are called once for one ci-instrumented step function', async () => {
      const exitCode = await cli.run(
        [
          'stepfunctions',
          'uninstrument',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction',
        ],
        context
      )

      // console.log(context.toString())
      expect(exitCode).toBe(0)
      expect(aws.describeStateMachine).toHaveBeenCalledTimes(1)
      expect(aws.describeSubscriptionFilters).toHaveBeenCalledTimes(1)
      expect(aws.deleteSubscriptionFilter).toHaveBeenCalledTimes(1)
      expect(aws.untagResource).toHaveBeenCalledTimes(1)
    })

    test('all aws commands are called twice for two ci-instrumented step functions', async () => {
      const exitCode = await cli.run(
        [
          'stepfunctions',
          'uninstrument',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction2222',
        ],
        context
      )

      // console.log(context.toString())
      expect(exitCode).toBe(0)
      expect(aws.describeStateMachine).toHaveBeenCalledTimes(2)
      expect(aws.describeSubscriptionFilters).toHaveBeenCalledTimes(2)
      expect(aws.deleteSubscriptionFilter).toHaveBeenCalledTimes(2)
      expect(aws.untagResource).toHaveBeenCalledTimes(2)
    })

    test('no subscription filters are created by ci, so deleteSubscriptionFilter is not called', async () => {
      aws.describeSubscriptionFilters = jest.fn().mockImplementation(() => ({
        subscriptionFilters: [
          {
            destinationArn: 'arn:aws:lambda:us-east-1:000000000000:function:DatadogForwarder',
            filterName: 'test-filter-name-that-does-not-have-DD_CI_IDENTIFING_STRING-string',
            filterPattern: '',
            logGroupName: '/aws/vendedlogs/states/ExampleStepFunction-Logs-test',
          },
        ],
      }))

      const exitCode = await cli.run(
        [
          'stepfunctions',
          'uninstrument',
          '--step-function',
          'arn:aws:states:us-east-1:000000000000:stateMachine:ExampleStepFunction',
        ],
        context
      )

      // console.log(context.toString())
      expect(exitCode).toBe(0)
      expect(aws.describeStateMachine).toHaveBeenCalledTimes(1)
      expect(aws.describeSubscriptionFilters).toHaveBeenCalledTimes(1)
      expect(aws.deleteSubscriptionFilter).toHaveBeenCalledTimes(0)
      expect(aws.untagResource).toHaveBeenCalledTimes(1) // Will always be called
    })
  })
})
