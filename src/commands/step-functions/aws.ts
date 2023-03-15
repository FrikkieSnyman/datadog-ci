import {CloudWatchLogs, StepFunctions} from 'aws-sdk'

import {Operation} from './constants'
import {
  CreateLogGroupRequest,
  DeleteSubscriptionFilterRequest,
  PutSubscriptionFilterRequest,
  TagStepFunctionRequest,
  UntagStepFunctionRequest,
  UpdateStepFunctionRequest,
} from './interfaces'

export const createLogGroup = (cloudWatchLogsClient: CloudWatchLogs, logGroupName: string): CreateLogGroupRequest => {
  const params = {
    logGroupName,
  }

  return {
    function: cloudWatchLogsClient.createLogGroup(params),
    operation: Operation.CreateLogGroup,
    params,
  }
}

export const deleteSubscriptionFilter = (
  cloudWatchLogsClient: CloudWatchLogs,
  filterName: string,
  logGroupName: string
): DeleteSubscriptionFilterRequest => {
  const params = {
    filterName,
    logGroupName,
  }

  return {
    function: cloudWatchLogsClient.deleteSubscriptionFilter(params),
    operation: Operation.DeleteSubscriptionFilter,
    params,
  }
}

export const enableStepFunctionLogs = (
  stepFunctionsClient: StepFunctions,
  stepFunction: StepFunctions.DescribeStateMachineOutput,
  logGroupArn: string
): UpdateStepFunctionRequest => {
  const params = {
    stateMachineArn: stepFunction.stateMachineArn,
    loggingConfiguration: {
      destinations: [{cloudWatchLogsLogGroup: {logGroupArn}}],
      level: 'ALL',
      includeExecutionData: true,
    },
  }

  return {
    function: stepFunctionsClient.updateStateMachine(params),
    operation: Operation.UpdateStateMachine,
    params,
    previousParams: {
      stateMachineArn: stepFunction.stateMachineArn,
      loggingConfiguration: stepFunction.loggingConfiguration,
    },
  }
}

export const getStepFunction = async (
  stepFunctionsClient: StepFunctions,
  stepFunctionArn: string
): Promise<StepFunctions.DescribeStateMachineOutput> => {
  return stepFunctionsClient.describeStateMachine({stateMachineArn: stepFunctionArn}).promise()
}

export const listSubscriptionFilters = (
  cloudWatchLogsClient: CloudWatchLogs,
  logGroupName: string
): Promise<CloudWatchLogs.DescribeSubscriptionFiltersResponse> => {
  return cloudWatchLogsClient.describeSubscriptionFilters({logGroupName}).promise()
}

export const listStepFunctionTags = async (
  stepFunctionsClient: StepFunctions,
  stepFunctionArn: string
): Promise<StepFunctions.ListTagsForResourceOutput> => {
  return stepFunctionsClient.listTagsForResource({resourceArn: stepFunctionArn}).promise()
}

export const putSubscriptionFilter = (
  cloudWatchLogsClient: CloudWatchLogs,
  forwarderArn: string,
  filterName: string,
  logGroupName: string
): PutSubscriptionFilterRequest => {
  const params = {
    destinationArn: forwarderArn,
    filterName,
    filterPattern: '',
    logGroupName,
  }

  return {
    function: cloudWatchLogsClient.putSubscriptionFilter(params),
    operation: Operation.PutSubscriptionFilter,
    params,
  }
}

export const tagStepFunction = (
  stepFunctionsClient: StepFunctions,
  stepFunctionArn: string,
  tags: {key: string; value: string}[]
): TagStepFunctionRequest => {
  const params = {
    resourceArn: stepFunctionArn,
    tags,
  }

  return {
    function: stepFunctionsClient.tagResource(params),
    operation: Operation.TagResource,
    params,
  }
}

export const untagStepFunction = (
  stepFunctionsClient: StepFunctions,
  stepFunctionArn: string,
  tagKeys: string[]
): UntagStepFunctionRequest => {
  const params = {
    resourceArn: stepFunctionArn,
    tagKeys,
  }

  return {
    function: stepFunctionsClient.untagResource(params),
    operation: Operation.UntagResource,
    params,
  }
}
