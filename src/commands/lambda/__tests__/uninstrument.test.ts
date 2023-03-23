jest.mock('fs')
jest.mock('aws-sdk')
jest.mock('../prompt')
jest.mock('../renderer', () => require('../__mocks__/renderer'))
jest.mock('../../../../package.json', () => ({version: 'XXXX'}))

import * as fs from 'fs'

import {Lambda, SharedIniFileCredentials} from 'aws-sdk'

import {
  AWS_ACCESS_KEY_ID_ENV_VAR,
  AWS_DEFAULT_REGION_ENV_VAR,
  AWS_SECRET_ACCESS_KEY_ENV_VAR,
  ENVIRONMENT_ENV_VAR,
  FLUSH_TO_LOG_ENV_VAR,
  LAMBDA_HANDLER_ENV_VAR,
  LOG_LEVEL_ENV_VAR,
  MERGE_XRAY_TRACES_ENV_VAR,
  SERVICE_ENV_VAR,
  SITE_ENV_VAR,
  TRACE_ENABLED_ENV_VAR,
  VERSION_ENV_VAR,
} from '../constants'
import {requestAWSCredentials, requestChangesConfirmation, requestFunctionSelection} from '../prompt'
import {UninstrumentCommand} from '../uninstrument'

import {
  createCommand,
  createMockContext,
  makeCli,
  makeMockLambda,
  mockAwsAccessKeyId,
  mockAwsSecretAccessKey,
} from './fixtures'

describe('lambda', () => {
  describe('uninstrument', () => {
    describe('execute', () => {
      const OLD_ENV = process.env
      beforeEach(() => {
        jest.resetModules()
        process.env = {}
      })
      afterAll(() => {
        process.env = OLD_ENV
      })

      test('prints dry run data for a valid uninstrumentation', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        ;(Lambda as any).mockImplementation(() =>
          makeMockLambda({
            'arn:aws:lambda:us-east-1:000000000000:function:uninstrument': {
              Architectures: ['x86_64'],
              Environment: {
                Variables: {
                  [ENVIRONMENT_ENV_VAR]: 'staging',
                  [FLUSH_TO_LOG_ENV_VAR]: 'true',
                  [LAMBDA_HANDLER_ENV_VAR]: 'lambda_function.lambda_handler',
                  [LOG_LEVEL_ENV_VAR]: 'debug',
                  [MERGE_XRAY_TRACES_ENV_VAR]: 'false',
                  [SERVICE_ENV_VAR]: 'middletier',
                  [SITE_ENV_VAR]: 'datadoghq.com',
                  [TRACE_ENABLED_ENV_VAR]: 'true',
                  [VERSION_ENV_VAR]: '0.2',
                  USER_VARIABLE: 'shouldnt be deleted by uninstrumentation',
                },
              },
              FunctionArn: 'arn:aws:lambda:us-east-1:000000000000:function:uninstrument',
              Handler: 'datadog_lambda.handler.handler',
              Layers: [
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Extension:11',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Python38:49',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
              ],
              Runtime: 'python3.8',
            },
          })
        )
        const cli = makeCli()
        const context = createMockContext() as any
        const functionARN = 'arn:aws:lambda:us-east-1:000000000000:function:uninstrument'
        process.env.DATADOG_API_KEY = '1234'
        const code = await cli.run(['lambda', 'uninstrument', '-f', functionARN, '-r', 'us-east-1', '-d'], context)
        const output = context.stdout.toString()
        expect(code).toBe(0)
        expect(output).toMatchInlineSnapshot(`
          "
          [Dry Run] 🐶 Uninstrumenting Lambda function

          [!] Functions to be updated:
          	- arn:aws:lambda:us-east-1:000000000000:function:uninstrument

          [Dry Run] Will apply the following updates:
          UpdateFunctionConfiguration -> arn:aws:lambda:us-east-1:000000000000:function:uninstrument
          {
            \\"FunctionName\\": \\"arn:aws:lambda:us-east-1:000000000000:function:uninstrument\\",
            \\"Handler\\": \\"lambda_function.lambda_handler\\",
            \\"Environment\\": {
              \\"Variables\\": {
                \\"USER_VARIABLE\\": \\"shouldnt be deleted by uninstrumentation\\"
              }
            },
            \\"Layers\\": []
          }
          "
        `)
      })
      test('runs function update command for valid uninstrumentation', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        const lambda = makeMockLambda({
          'arn:aws:lambda:us-east-1:000000000000:function:uninstrument': {
            Environment: {
              Variables: {
                [ENVIRONMENT_ENV_VAR]: 'staging',
                [FLUSH_TO_LOG_ENV_VAR]: 'true',
                [LAMBDA_HANDLER_ENV_VAR]: 'lambda_function.lambda_handler',
                [LOG_LEVEL_ENV_VAR]: 'debug',
                [MERGE_XRAY_TRACES_ENV_VAR]: 'false',
                [SERVICE_ENV_VAR]: 'middletier',
                [SITE_ENV_VAR]: 'datadoghq.com',
                [TRACE_ENABLED_ENV_VAR]: 'true',
                [VERSION_ENV_VAR]: '0.2',
                USER_VARIABLE: 'shouldnt be deleted by uninstrumentation',
              },
            },
            FunctionArn: 'arn:aws:lambda:us-east-1:000000000000:function:uninstrument',
            Handler: 'datadog_lambda.handler.handler',
            Layers: [
              {
                Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Extension:11',
                CodeSize: 0,
                SigningJobArn: 'some-signing-job-arn',
                SigningProfileVersionArn: 'some-signing-profile',
              },
              {
                Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Python38:49',
                CodeSize: 0,
                SigningJobArn: 'some-signing-job-arn',
                SigningProfileVersionArn: 'some-signing-profile',
              },
            ],
            Runtime: 'python3.8',
          },
        })
        ;(Lambda as any).mockImplementation(() => lambda)

        const cli = makeCli()
        const context = createMockContext() as any
        const functionARN = 'arn:aws:lambda:us-east-1:000000000000:function:uninstrument'
        process.env.DATADOG_API_KEY = '1234'
        await cli.run(['lambda', 'uninstrument', '-f', functionARN, '-r', 'us-east-1'], context)
        expect(lambda.updateFunctionConfiguration).toHaveBeenCalled()
      })
      test('aborts early when the aws-sdk throws an error', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        ;(Lambda as any).mockImplementation(() => ({
          getFunction: jest.fn().mockImplementation(() => ({promise: () => Promise.reject('Lambda failed')})),
        }))

        process.env = {}
        const command = createCommand(UninstrumentCommand)
        command['functions'] = ['my-func']
        command['region'] = 'us-east-1'

        const code = await command['execute']()
        const output = command.context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatch("[Error] Couldn't fetch Lambda functions. Lambda failed\n")
      })
      test("aborts early when function regions can't be found", async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        ;(Lambda as any).mockImplementation(() => makeMockLambda({}))

        const cli = makeCli()
        const context = createMockContext() as any
        const code = await cli.run(['lambda', 'uninstrument', '--function', 'my-func'], context)

        const output = context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatch(
          'No default region specified for ["my-func"]. Use -r, --region, or use a full functionARN'
        )
      })
      test('aborts early when no functions are specified', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        ;(Lambda as any).mockImplementation(() => makeMockLambda({}))
        const cli = makeCli()
        const context = createMockContext() as any
        const code = await cli.run(['lambda', 'uninstrument'], context)
        const output = context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatchInlineSnapshot(`
          "
          🐶 Uninstrumenting Lambda function
          [Error] No functions specified to remove instrumentation.
          "
        `)
      })
      test('aborts early when no functions are specified while using config file', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({}))

        process.env = {}
        const command = createCommand(UninstrumentCommand)
        command['config']['region'] = 'ap-southeast-1'
        await command['execute']()
        const output = command.context.stdout.toString()
        expect(output).toMatchInlineSnapshot(`
          "
          🐶 Uninstrumenting Lambda function
          [Error] No functions specified to remove instrumentation.
          "
        `)
      })
      test('aborts if functions and a pattern are set at the same time', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({}))

        process.env = {}
        let command = createCommand(UninstrumentCommand)
        command['config']['region'] = 'ap-southeast-1'
        command['config']['functions'] = ['arn:aws:lambda:ap-southeast-1:123456789012:function:lambda-hello-world']
        command['regExPattern'] = 'valid-pattern'
        await command['execute']()
        let output = command.context.stdout.toString()
        expect(output).toMatch(
          'Functions in config file and "--functions-regex" should not be used at the same time.\n'
        )

        command = createCommand(UninstrumentCommand)
        command['region'] = 'ap-southeast-1'
        command['functions'] = ['arn:aws:lambda:ap-southeast-1:123456789012:function:lambda-hello-world']
        command['regExPattern'] = 'valid-pattern'
        await command['execute']()
        output = command.context.stdout.toString()
        expect(output).toMatch('"--functions" and "--functions-regex" should not be used at the same time.\n')
      })
      test('aborts if the regEx pattern is an ARN', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({}))

        process.env = {}
        const command = createCommand(UninstrumentCommand)
        command['region'] = 'ap-southeast-1'
        command['regExPattern'] = 'arn:aws:lambda:ap-southeast-1:123456789012:function:*'
        const code = await command['execute']()
        const output = command.context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatch(`"--functions-regex" isn't meant to be used with ARNs.\n`)
      })

      test('aborts if the regEx pattern is set but no region is specified', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({}))

        process.env = {}
        const command = createCommand(UninstrumentCommand)
        command['regExPattern'] = 'my-function'
        const code = await command['execute']()
        const output = command.context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatch('No default region specified. Use `-r`, `--region`.')
      })

      test('aborts if the the aws-sdk fails', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({}))
        ;(Lambda as any).mockImplementation(() => ({
          listFunctions: jest.fn().mockImplementation(() => ({promise: () => Promise.reject('ListFunctionsError')})),
        }))
        process.env = {}
        ;(Lambda as any).mockImplementation(() => ({
          listFunctions: jest.fn().mockImplementation(() => ({promise: () => Promise.reject('ListFunctionsError')})),
        }))
        const command = createCommand(UninstrumentCommand)
        command['region'] = 'ap-southeast-1'
        command['regExPattern'] = 'my-function'
        const code = await command['execute']()
        const output = command.context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatch(
          "\n[Error] Couldn't fetch Lambda functions. Error: Max retry count exceeded. ListFunctionsError\n"
        )
      })

      test('uninstrument multiple functions interactively', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        ;(Lambda as any).mockImplementation(() =>
          makeMockLambda({
            'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world': {
              Architectures: ['x86_64'],
              Environment: {
                Variables: {
                  [ENVIRONMENT_ENV_VAR]: 'staging',
                  [FLUSH_TO_LOG_ENV_VAR]: 'true',
                  [LAMBDA_HANDLER_ENV_VAR]: 'lambda_function.lambda_handler',
                  [LOG_LEVEL_ENV_VAR]: 'debug',
                  [MERGE_XRAY_TRACES_ENV_VAR]: 'false',
                  [SERVICE_ENV_VAR]: 'middletier',
                  [SITE_ENV_VAR]: 'datadoghq.com',
                  [TRACE_ENABLED_ENV_VAR]: 'true',
                  [VERSION_ENV_VAR]: '0.2',
                  USER_VARIABLE: 'shouldnt be deleted by uninstrumentation',
                },
              },
              FunctionArn: 'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world',
              FunctionName: 'lambda-hello-world',
              Handler: 'datadog_lambda.handler.handler',
              Layers: [
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Extension:11',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Python38:49',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
              ],
              Runtime: 'python3.8',
            },
            'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world-2': {
              Architectures: ['x86_64'],
              Environment: {
                Variables: {
                  [ENVIRONMENT_ENV_VAR]: 'staging',
                  [FLUSH_TO_LOG_ENV_VAR]: 'true',
                  [LAMBDA_HANDLER_ENV_VAR]: 'lambda_function.lambda_handler',
                  [LOG_LEVEL_ENV_VAR]: 'debug',
                  [MERGE_XRAY_TRACES_ENV_VAR]: 'false',
                  [SERVICE_ENV_VAR]: 'middletier',
                  [SITE_ENV_VAR]: 'datadoghq.com',
                  [TRACE_ENABLED_ENV_VAR]: 'true',
                  [VERSION_ENV_VAR]: '0.2',
                },
              },
              FunctionArn: 'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world-2',
              FunctionName: 'lambda-hello-world-2',
              Handler: 'datadog_lambda.handler.handler',
              Layers: [
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Extension:11',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Python39:49',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
              ],
              Runtime: 'python3.9',
            },
          })
        )
        ;(requestAWSCredentials as any).mockImplementation(() => {
          process.env[AWS_ACCESS_KEY_ID_ENV_VAR] = mockAwsAccessKeyId
          process.env[AWS_SECRET_ACCESS_KEY_ENV_VAR] = mockAwsSecretAccessKey
          process.env[AWS_DEFAULT_REGION_ENV_VAR] = 'sa-east-1'
        })
        ;(requestFunctionSelection as any).mockImplementation(() => [
          'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world',
          'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world-2',
        ])
        ;(requestChangesConfirmation as any).mockImplementation(() => true)

        const cli = makeCli()
        const context = createMockContext() as any
        const code = await cli.run(['lambda', 'uninstrument', '-i'], context)
        const output = context.stdout.toString()
        expect(code).toBe(0)
        expect(output).toMatchSnapshot()
      })

      test('uninstrument multiple specified functions interactively', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        ;(Lambda as any).mockImplementation(() =>
          makeMockLambda({
            'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world': {
              Architectures: ['x86_64'],
              Environment: {
                Variables: {
                  [ENVIRONMENT_ENV_VAR]: 'staging',
                  [FLUSH_TO_LOG_ENV_VAR]: 'true',
                  [LAMBDA_HANDLER_ENV_VAR]: 'lambda_function.lambda_handler',
                  [LOG_LEVEL_ENV_VAR]: 'debug',
                  [MERGE_XRAY_TRACES_ENV_VAR]: 'false',
                  [SERVICE_ENV_VAR]: 'middletier',
                  [SITE_ENV_VAR]: 'datadoghq.com',
                  [TRACE_ENABLED_ENV_VAR]: 'true',
                  [VERSION_ENV_VAR]: '0.2',
                  USER_VARIABLE: 'shouldnt be deleted by uninstrumentation',
                },
              },
              FunctionArn: 'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world',
              FunctionName: 'lambda-hello-world',
              Handler: 'datadog_lambda.handler.handler',
              Layers: [
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Extension:11',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Python38:49',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
              ],
              Runtime: 'python3.8',
            },
            'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world-2': {
              Architectures: ['x86_64'],
              Environment: {
                Variables: {
                  [ENVIRONMENT_ENV_VAR]: 'staging',
                  [FLUSH_TO_LOG_ENV_VAR]: 'true',
                  [LAMBDA_HANDLER_ENV_VAR]: 'lambda_function.lambda_handler',
                  [LOG_LEVEL_ENV_VAR]: 'debug',
                  [MERGE_XRAY_TRACES_ENV_VAR]: 'false',
                  [SERVICE_ENV_VAR]: 'middletier',
                  [SITE_ENV_VAR]: 'datadoghq.com',
                  [TRACE_ENABLED_ENV_VAR]: 'true',
                  [VERSION_ENV_VAR]: '0.2',
                },
              },
              FunctionArn: 'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world-2',
              FunctionName: 'lambda-hello-world-2',
              Handler: 'datadog_lambda.handler.handler',
              Layers: [
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Extension:11',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
                {
                  Arn: 'arn:aws:lambda:sa-east-1:000000000000:layer:Datadog-Python39:49',
                  CodeSize: 0,
                  SigningJobArn: 'some-signing-job-arn',
                  SigningProfileVersionArn: 'some-signing-profile',
                },
              ],
              Runtime: 'python3.9',
            },
          })
        )
        ;(requestAWSCredentials as any).mockImplementation(() => {
          process.env[AWS_ACCESS_KEY_ID_ENV_VAR] = mockAwsAccessKeyId
          process.env[AWS_SECRET_ACCESS_KEY_ENV_VAR] = mockAwsSecretAccessKey
          process.env[AWS_DEFAULT_REGION_ENV_VAR] = 'sa-east-1'
        })
        ;(requestFunctionSelection as any).mockImplementation(() => [
          'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world',
          'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world-2',
        ])
        ;(requestChangesConfirmation as any).mockImplementation(() => true)

        const cli = makeCli()
        const context = createMockContext() as any
        const code = await cli.run(
          [
            'lambda',
            'uninstrument',
            '-i',
            '-f',
            'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world',
            '-f',
            'arn:aws:lambda:sa-east-1:123456789012:function:lambda-hello-world-2',
          ],
          context
        )
        const output = context.stdout.toString()
        expect(code).toBe(0)
        expect(output).toMatchSnapshot()
      })

      test('aborts if a problem occurs while setting the AWS credentials interactively', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        ;(requestAWSCredentials as any).mockImplementation(() => Promise.reject('Unexpected error'))
        const cli = makeCli()
        const context = createMockContext() as any
        const code = await cli.run(['lambda', 'uninstrument', '-i'], context)
        const output = context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatchInlineSnapshot(`
          "
          🐶 Uninstrumenting Lambda function
          [!] No AWS credentials found, let's set them up! Or you can re-run the command and supply the AWS credentials in the same way when you invoke the AWS CLI.
          [Error] Unexpected error
          "
        `)
      })

      test('aborts if there are no functions to uninstrument in the user AWS account', async () => {
        process.env = {
          [AWS_ACCESS_KEY_ID_ENV_VAR]: mockAwsAccessKeyId,
          [AWS_SECRET_ACCESS_KEY_ENV_VAR]: mockAwsSecretAccessKey,
          [AWS_DEFAULT_REGION_ENV_VAR]: 'sa-east-1',
        }
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        ;(Lambda as any).mockImplementation(() => makeMockLambda({}))
        const cli = makeCli()
        const context = createMockContext() as any
        const code = await cli.run(['lambda', 'uninstrument', '-i'], context)
        const output = context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatchInlineSnapshot(`
          "
          🐶 Uninstrumenting Lambda function
          [Error] Couldn't find any Lambda functions in the specified region.
          "
        `)
      })

      test('aborts early when the aws-sdk throws an error while uninstrumenting interactively', async () => {
        process.env = {
          [AWS_ACCESS_KEY_ID_ENV_VAR]: mockAwsAccessKeyId,
          [AWS_SECRET_ACCESS_KEY_ENV_VAR]: mockAwsSecretAccessKey,
          [AWS_DEFAULT_REGION_ENV_VAR]: 'sa-east-1',
        }
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        ;(Lambda as any).mockImplementation(() => ({
          listFunctions: jest.fn().mockImplementation(() => ({promise: () => Promise.reject('ListFunctionsError')})),
        }))

        const cli = makeCli()
        const context = createMockContext() as any
        const code = await cli.run(['lambda', 'uninstrument', '-i'], context)
        const output = context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatchInlineSnapshot(`
          "
          🐶 Uninstrumenting Lambda function
          [Error] Couldn't fetch Lambda functions. Error: Max retry count exceeded. ListFunctionsError
          "
        `)
      })

      test('prints error when updating aws profile credentials fails', async () => {
        ;(SharedIniFileCredentials as any).mockImplementation(() => {
          throw Error('Update failed!')
        })

        const cli = makeCli()
        const context = createMockContext() as any
        const functionARN = 'arn:aws:lambda:us-east-1:123456789012:function:lambda-hello-world'
        const code = await cli.run(
          ['lambda', 'uninstrument', '-f', functionARN, '--profile', 'SOME-AWS-PROFILE'],
          context
        )
        const output = context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatchInlineSnapshot(`
          "
          🐶 Uninstrumenting Lambda function
          [Error] Error: Couldn't set AWS profile credentials. Update failed!
          "
        `)
      })

      test('prints which functions failed to uninstrument without aborting when at least one function was uninstrumented correctly', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        const failingLambdas = [
          'arn:aws:lambda:us-east-1:123456789012:function:lambda-1-us-east-1',
          'arn:aws:lambda:us-east-1:123456789012:function:lambda-2-us-east-1',
          'arn:aws:lambda:us-east-2:123456789012:function:lambda-1-us-east-2',
        ]
        ;(Lambda as any).mockImplementation(() => ({
          ...makeMockLambda({
            'arn:aws:lambda:us-east-1:123456789012:function:lambda-1-us-east-1': {
              FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:lambda-1-us-east-1',
              FunctionName: 'lambda-1-us-east-1',
              Handler: 'index.handler',
              Runtime: 'nodejs12.x',
            },
            'arn:aws:lambda:us-east-1:123456789012:function:lambda-2-us-east-1': {
              FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:lambda-2-us-east-1',
              FunctionName: 'lambda-2-us-east-1',
              Handler: 'index.handler',
              Runtime: 'nodejs12.x',
            },
            'arn:aws:lambda:us-east-1:123456789012:function:lambda-3-us-east-1': {
              FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:lambda-3-us-east-1',
              FunctionName: 'lambda-3-us-east-1',
              Handler: 'index.handler',
              Runtime: 'nodejs12.x',
            },
            'arn:aws:lambda:us-east-2:123456789012:function:lambda-1-us-east-2': {
              FunctionArn: 'arn:aws:lambda:us-east-2:123456789012:function:lambda-1-us-east-2',
              FunctionName: 'lambda-1-us-east-2',
              Handler: 'index.handler',
              Runtime: 'nodejs14.x',
            },
            'arn:aws:lambda:us-east-2:123456789012:function:lambda-2-us-east-2': {
              FunctionArn: 'arn:aws:lambda:us-east-2:123456789012:function:lambda-2-us-east-2',
              FunctionName: 'lambda-2-us-east-2',
              Handler: 'index.handler',
              Runtime: 'nodejs16.x',
            },
            'arn:aws:lambda:us-east-2:123456789012:function:lambda-3-us-east-2': {
              FunctionArn: 'arn:aws:lambda:us-east-2:123456789012:function:lambda-3-us-east-2',
              FunctionName: 'lambda-3-us-east-2',
              Handler: 'index.handler',
              Runtime: 'nodejs18.x',
            },
          }),
          updateFunctionConfiguration: jest.fn().mockImplementation((updateRequest) => {
            if (failingLambdas.includes(updateRequest['FunctionName'])) {
              return {promise: () => Promise.reject(Error('Unexpected error updating request'))}
            }

            return {promise: () => Promise.resolve()}
          }),
        }))

        const cli = makeCli()
        const context = createMockContext() as any
        const code = await cli.run(
          [
            'lambda',
            'instrument',
            '-f',
            'arn:aws:lambda:us-east-1:123456789012:function:lambda-1-us-east-1',
            '-f',
            'arn:aws:lambda:us-east-1:123456789012:function:lambda-2-us-east-1',
            '-f',
            'arn:aws:lambda:us-east-1:123456789012:function:lambda-3-us-east-1',
            '-f',
            'arn:aws:lambda:us-east-2:123456789012:function:lambda-1-us-east-2',
            '-f',
            'arn:aws:lambda:us-east-2:123456789012:function:lambda-2-us-east-2',
            '-f',
            'arn:aws:lambda:us-east-2:123456789012:function:lambda-3-us-east-2',
          ],
          context
        )
        const output = context.stdout.toString()
        expect(code).toBe(0)
        expect(output).toMatchSnapshot()
      })

      test('aborts when every lambda function fails to update on uninstrument', async () => {
        ;(fs.readFile as any).mockImplementation((a: any, b: any, callback: any) => callback({code: 'ENOENT'}))
        const failingLambdas = [
          'arn:aws:lambda:us-east-1:123456789012:function:lambda-1-us-east-1',
          'arn:aws:lambda:us-east-2:123456789012:function:lambda-1-us-east-2',
        ]
        ;(Lambda as any).mockImplementation(() => ({
          ...makeMockLambda({
            'arn:aws:lambda:us-east-1:123456789012:function:lambda-1-us-east-1': {
              FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:lambda-1-us-east-1',
              FunctionName: 'lambda-1-us-east-1',
              Handler: 'index.handler',
              Runtime: 'nodejs12.x',
            },
            'arn:aws:lambda:us-east-2:123456789012:function:lambda-1-us-east-2': {
              FunctionArn: 'arn:aws:lambda:us-east-2:123456789012:function:lambda-1-us-east-2',
              FunctionName: 'lambda-1-us-east-2',
              Handler: 'index.handler',
              Runtime: 'nodejs14.x',
            },
          }),
          updateFunctionConfiguration: jest.fn().mockImplementation((updateRequest) => {
            if (failingLambdas.includes(updateRequest['FunctionName'])) {
              return {promise: () => Promise.reject(Error('Unexpected error updating request'))}
            }

            return {promise: () => Promise.resolve()}
          }),
        }))

        const cli = makeCli()
        const context = createMockContext() as any
        const code = await cli.run(
          [
            'lambda',
            'instrument',
            '-f',
            'arn:aws:lambda:us-east-1:123456789012:function:lambda-1-us-east-1',
            '-f',
            'arn:aws:lambda:us-east-2:123456789012:function:lambda-1-us-east-2',
          ],
          context
        )
        const output = context.stdout.toString()
        expect(code).toBe(1)
        expect(output).toMatchSnapshot()
      })
    })

    describe('printPlannedActions', () => {
      test('prints no output when list is empty', () => {
        process.env = {}
        const command = createCommand(UninstrumentCommand)

        command['printPlannedActions']([])
        const output = command.context.stdout.toString()
        expect(output).toMatchInlineSnapshot(`
                   "
                   No updates will be applied.
                   "
                `)
      })
    })
  })
})
