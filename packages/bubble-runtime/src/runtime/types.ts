import { ScopeType } from '@bubblelab/ts-scope-manager';

export type StepType =
  | 'control_flow'
  | 'bubble_block'
  | 'setup'
  | 'finalization';

export type ControlType =
  | 'for_loop'
  | 'while_loop'
  | 'if_statement'
  | 'try_catch';

export interface Operation {
  type:
    | 'new_bubble'
    | 'await_action'
    | 'assign'
    | 'if_condition'
    | 'for_iteration'
    | 'try_catch';
  bubbleName?: string;
  variableName?: string;
  expression?: string;
  condition?: string;
}

export interface MiniStep {
  id: string;
  type:
    | 'bubble_instantiation'
    | 'bubble_execution'
    | 'variable_assignment'
    | 'condition'
    | 'loop_iteration'
    | 'script';
  startLine: number;
  endLine: number;
  operation: Operation;
}

export interface ExecutionStep {
  id: string;
  type: StepType;
  startLine: number;
  endLine: number;
  controlType?: ScopeType;
  miniSteps?: MiniStep[];
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
}
