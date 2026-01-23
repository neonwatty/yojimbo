import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSmartTodosStore,
  getEffectiveClarity,
  selectTodosNeedingClarification,
  selectRoutableTodos,
  selectTodoById,
} from './smartTodosStore';
import type { ParsedTodo, ParsedTodosResponse, Project } from '@cc-orchestrator/shared';

const createMockTodo = (id: string, overrides?: Partial<ParsedTodo>): ParsedTodo => ({
  id,
  originalText: `Original text for todo ${id}`,
  title: `Todo ${id}`,
  type: 'feature',
  projectId: `project-${id}`,
  projectConfidence: 0.9,
  clarity: 'clear',
  ...overrides,
});

const createMockProject = (id: string, overrides?: Partial<Project>): Project => ({
  id,
  name: `Project ${id}`,
  path: `/home/user/projects/${id}`,
  gitRemote: null,
  repoName: null,
  lastActivityAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('smartTodosStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSmartTodosStore.getState().reset();
  });

  describe('setAvailability', () => {
    it('sets isAvailable and availabilityMessage', () => {
      useSmartTodosStore.getState().setAvailability(true, 'Smart Tasks ready');

      expect(useSmartTodosStore.getState().isAvailable).toBe(true);
      expect(useSmartTodosStore.getState().availabilityMessage).toBe('Smart Tasks ready');
    });

    it('can set to unavailable with message', () => {
      useSmartTodosStore.getState().setAvailability(false, 'API key required');

      expect(useSmartTodosStore.getState().isAvailable).toBe(false);
      expect(useSmartTodosStore.getState().availabilityMessage).toBe('API key required');
    });
  });

  describe('setRawInput', () => {
    it('sets rawInput', () => {
      useSmartTodosStore.getState().setRawInput('Fix bug in auth module');

      expect(useSmartTodosStore.getState().rawInput).toBe('Fix bug in auth module');
    });

    it('can clear rawInput', () => {
      useSmartTodosStore.getState().setRawInput('Some input');
      useSmartTodosStore.getState().setRawInput('');

      expect(useSmartTodosStore.getState().rawInput).toBe('');
    });
  });

  describe('startParsing', () => {
    it('sets state to parsing and clears errorMessage', () => {
      // First set an error
      useSmartTodosStore.getState().setError('Previous error');

      useSmartTodosStore.getState().startParsing();

      expect(useSmartTodosStore.getState().state).toBe('parsing');
      expect(useSmartTodosStore.getState().errorMessage).toBeNull();
    });

    it('transitions from idle state', () => {
      expect(useSmartTodosStore.getState().state).toBe('idle');

      useSmartTodosStore.getState().startParsing();

      expect(useSmartTodosStore.getState().state).toBe('parsing');
    });
  });

  describe('setParsedResult', () => {
    it('sets parsed state with all fields', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1'), createMockTodo('2')],
        suggestedOrder: ['1', '2'],
      };
      const summary = {
        totalTodos: 2,
        routableCount: 2,
        needsClarificationCount: 0,
        estimatedCost: '$0.05',
      };

      useSmartTodosStore.getState().setParsedResult('session-123', todosResponse, false, summary);

      const state = useSmartTodosStore.getState();
      expect(state.state).toBe('parsed');
      expect(state.sessionId).toBe('session-123');
      expect(state.parsedTodos).toEqual(todosResponse.todos);
      expect(state.suggestedOrder).toEqual(['1', '2']);
      expect(state.needsClarification).toBe(false);
      expect(state.summary).toEqual(summary);
      expect(state.errorMessage).toBeNull();
    });

    it('sets needsClarification flag when true', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1', { clarity: 'ambiguous' })],
        suggestedOrder: ['1'],
      };
      const summary = {
        totalTodos: 1,
        routableCount: 0,
        needsClarificationCount: 1,
        estimatedCost: '$0.02',
      };

      useSmartTodosStore.getState().setParsedResult('session-456', todosResponse, true, summary);

      expect(useSmartTodosStore.getState().needsClarification).toBe(true);
    });

    it('clears previous error on success', () => {
      useSmartTodosStore.getState().setError('Old error');

      const todosResponse: ParsedTodosResponse = { todos: [], suggestedOrder: [] };
      useSmartTodosStore.getState().setParsedResult('session-789', todosResponse, false, null);

      expect(useSmartTodosStore.getState().errorMessage).toBeNull();
    });
  });

  describe('startClarifying', () => {
    it('sets state to clarifying', () => {
      useSmartTodosStore.getState().startClarifying();

      expect(useSmartTodosStore.getState().state).toBe('clarifying');
    });
  });

  describe('setError', () => {
    it('sets state to error with message', () => {
      useSmartTodosStore.getState().setError('Failed to parse tasks');

      expect(useSmartTodosStore.getState().state).toBe('error');
      expect(useSmartTodosStore.getState().errorMessage).toBe('Failed to parse tasks');
    });
  });

  describe('updateTask', () => {
    it('updates a specific task', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1'), createMockTodo('2')],
        suggestedOrder: ['1', '2'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().updateTodo('1', { title: 'Updated Title' });

      expect(useSmartTodosStore.getState().parsedTodos[0].title).toBe('Updated Title');
    });

    it('does not modify other tasks', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1'), createMockTodo('2')],
        suggestedOrder: ['1', '2'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().updateTodo('1', { title: 'Updated' });

      expect(useSmartTodosStore.getState().parsedTodos[1].title).toBe('Todo 2');
    });

    it('can update multiple fields at once', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1')],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().updateTodo('1', {
        title: 'New Title',
        type: 'bug',
        projectConfidence: 0.5,
      });

      const task = useSmartTodosStore.getState().parsedTodos[0];
      expect(task.title).toBe('New Title');
      expect(task.type).toBe('bug');
      expect(task.projectConfidence).toBe(0.5);
    });

    it('does nothing if task not found', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1')],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().updateTodo('nonexistent', { title: 'Nope' });

      expect(useSmartTodosStore.getState().parsedTodos[0].title).toBe('Todo 1');
    });
  });

  describe('removeTask', () => {
    it('removes task from parsedTasks', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1'), createMockTodo('2')],
        suggestedOrder: ['1', '2'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().removeTodo('1');

      expect(useSmartTodosStore.getState().parsedTodos).toHaveLength(1);
      expect(useSmartTodosStore.getState().parsedTodos[0].id).toBe('2');
    });

    it('removes task from suggestedOrder', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1'), createMockTodo('2'), createMockTodo('3')],
        suggestedOrder: ['1', '2', '3'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().removeTodo('2');

      expect(useSmartTodosStore.getState().suggestedOrder).toEqual(['1', '3']);
    });

    it('handles removing non-existent task gracefully', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1')],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().removeTodo('nonexistent');

      expect(useSmartTodosStore.getState().parsedTodos).toHaveLength(1);
      expect(useSmartTodosStore.getState().suggestedOrder).toEqual(['1']);
    });
  });

  describe('selectProjectForTask', () => {
    it('updates projectId for a task', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1', { projectId: null, projectConfidence: 0 })],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().selectProjectForTodo('1', 'new-project-id');

      expect(useSmartTodosStore.getState().parsedTodos[0].projectId).toBe('new-project-id');
    });

    it('updates projectConfidence from projectMatches when match found', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [
          createMockTodo('1', {
            projectId: null,
            projectConfidence: 0,
            projectMatches: [
              { projectId: 'proj-a', confidence: 0.85 },
              { projectId: 'proj-b', confidence: 0.65 },
            ],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().selectProjectForTodo('1', 'proj-a');

      expect(useSmartTodosStore.getState().parsedTodos[0].projectConfidence).toBe(0.85);
    });

    it('keeps existing confidence if project not in matches', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [
          createMockTodo('1', {
            projectId: null,
            projectConfidence: 0.3,
            projectMatches: [{ projectId: 'proj-a', confidence: 0.9 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().selectProjectForTodo('1', 'other-project');

      expect(useSmartTodosStore.getState().parsedTodos[0].projectConfidence).toBe(0.3);
    });

    it('updates clarity to clear when confidence >= 0.7 and projectId exists', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [
          createMockTodo('1', {
            projectId: null,
            projectConfidence: 0,
            clarity: 'unknown_project',
            projectMatches: [{ projectId: 'proj-a', confidence: 0.8 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().selectProjectForTodo('1', 'proj-a');

      expect(useSmartTodosStore.getState().parsedTodos[0].clarity).toBe('clear');
    });

    it('updates clarity to clear for unknown_project when selecting any project', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [
          createMockTodo('1', {
            projectId: null,
            projectConfidence: 0.5, // Low confidence
            clarity: 'unknown_project',
            projectMatches: [{ projectId: 'proj-a', confidence: 0.5 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().selectProjectForTodo('1', 'proj-a');

      // Should be clear because confidence (0.5) < 0.7 but we have a projectId
      // and the previous clarity was unknown_project
      expect(useSmartTodosStore.getState().parsedTodos[0].clarity).toBe('clear');
    });

    it('clears clarificationNeeded when clarity becomes clear', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [
          createMockTodo('1', {
            projectId: null,
            projectConfidence: 0,
            clarity: 'unknown_project',
            clarificationNeeded: { question: 'Which project?' },
            projectMatches: [{ projectId: 'proj-a', confidence: 0.9 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().selectProjectForTodo('1', 'proj-a');

      expect(useSmartTodosStore.getState().parsedTodos[0].clarificationNeeded).toBeUndefined();
    });

    it('preserves clarificationNeeded when clarity is not clear', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [
          createMockTodo('1', {
            projectId: null,
            projectConfidence: 0.5,
            clarity: 'ambiguous',
            clarificationNeeded: { question: 'What do you mean?' },
            projectMatches: [{ projectId: 'proj-a', confidence: 0.5 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().selectProjectForTodo('1', 'proj-a');

      // With confidence 0.5 >= 0.7 is false, but we have a projectId
      // Looking at the logic: newConfidence >= 0.7 && projectId -> no (0.5 < 0.7)
      // task.clarity === 'unknown_project' && projectId -> no (clarity is 'ambiguous')
      // So clarity stays 'ambiguous' and clarificationNeeded should be preserved
      expect(useSmartTodosStore.getState().parsedTodos[0].clarificationNeeded).toEqual({
        question: 'What do you mean?',
      });
    });

    it('does not modify other tasks', () => {
      const todosResponse: ParsedTodosResponse = {
        todos: [
          createMockTodo('1', { projectId: 'proj-1' }),
          createMockTodo('2', { projectId: 'proj-2' }),
        ],
        suggestedOrder: ['1', '2'],
      };
      useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

      useSmartTodosStore.getState().selectProjectForTodo('1', 'new-proj');

      expect(useSmartTodosStore.getState().parsedTodos[1].projectId).toBe('proj-2');
    });
  });

  describe('setProjects', () => {
    it('sets projects array', () => {
      const projects = [createMockProject('1'), createMockProject('2')];

      useSmartTodosStore.getState().setProjects(projects);

      expect(useSmartTodosStore.getState().projects).toEqual(projects);
    });

    it('can clear projects', () => {
      useSmartTodosStore.getState().setProjects([createMockProject('1')]);
      useSmartTodosStore.getState().setProjects([]);

      expect(useSmartTodosStore.getState().projects).toEqual([]);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      // Set various state
      useSmartTodosStore.getState().setAvailability(true, 'Ready');
      useSmartTodosStore.getState().setRawInput('Some input');
      const todosResponse: ParsedTodosResponse = {
        todos: [createMockTodo('1')],
        suggestedOrder: ['1'],
      };
      useSmartTodosStore
        .getState()
        .setParsedResult('session-1', todosResponse, true, { totalTodos: 1, routableCount: 1, needsClarificationCount: 0, estimatedCost: '$0.01' });
      useSmartTodosStore.getState().setProjects([createMockProject('1')]);

      // Reset
      useSmartTodosStore.getState().reset();

      // Verify initial state
      const state = useSmartTodosStore.getState();
      expect(state.isAvailable).toBe(false);
      expect(state.availabilityMessage).toBe('Checking availability...');
      expect(state.state).toBe('idle');
      expect(state.errorMessage).toBeNull();
      expect(state.rawInput).toBe('');
      expect(state.sessionId).toBeNull();
      expect(state.parsedTodos).toEqual([]);
      expect(state.suggestedOrder).toEqual([]);
      expect(state.needsClarification).toBe(false);
      expect(state.summary).toBeNull();
      expect(state.projects).toEqual([]);
    });
  });
});

describe('getEffectiveClarity', () => {
  it('returns unknown_project when projectId is null', () => {
    const task = createMockTodo('1', {
      projectId: null,
      projectConfidence: 0.9,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('unknown_project');
  });

  it('returns ambiguous when projectConfidence < 0.7', () => {
    const task = createMockTodo('1', {
      projectId: 'proj-1',
      projectConfidence: 0.5,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('ambiguous');
  });

  it('returns task clarity when projectId exists and confidence >= 0.7', () => {
    const task = createMockTodo('1', {
      projectId: 'proj-1',
      projectConfidence: 0.8,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('clear');
  });

  it('returns ambiguous from parser when confidence >= 0.7 but parser says ambiguous', () => {
    const task = createMockTodo('1', {
      projectId: 'proj-1',
      projectConfidence: 0.9,
      clarity: 'ambiguous',
    });

    expect(getEffectiveClarity(task)).toBe('ambiguous');
  });

  it('returns ambiguous at exactly 0.7 confidence threshold', () => {
    const task = createMockTodo('1', {
      projectId: 'proj-1',
      projectConfidence: 0.7,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('clear');
  });

  it('returns ambiguous just below 0.7 threshold', () => {
    const task = createMockTodo('1', {
      projectId: 'proj-1',
      projectConfidence: 0.69,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('ambiguous');
  });
});

describe('selectTodosNeedingClarification', () => {
  beforeEach(() => {
    useSmartTodosStore.getState().reset();
  });

  it('returns tasks where effective clarity is not clear', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [
        createMockTodo('1', { projectId: null, clarity: 'clear' }), // Will be unknown_project
        createMockTodo('2', { projectId: 'proj-2', projectConfidence: 0.9, clarity: 'clear' }), // Clear
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const needsClarification = selectTodosNeedingClarification(useSmartTodosStore.getState());

    expect(needsClarification).toHaveLength(1);
    expect(needsClarification[0].id).toBe('1');
  });

  it('returns tasks with clarificationNeeded even if clarity is clear', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [
        createMockTodo('1', {
          projectId: 'proj-1',
          projectConfidence: 0.9,
          clarity: 'clear',
          clarificationNeeded: { question: 'Is this urgent?' },
        }),
      ],
      suggestedOrder: ['1'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const needsClarification = selectTodosNeedingClarification(useSmartTodosStore.getState());

    expect(needsClarification).toHaveLength(1);
    expect(needsClarification[0].id).toBe('1');
  });

  it('returns empty array when all tasks are clear', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [
        createMockTodo('1', { projectId: 'proj-1', projectConfidence: 0.9, clarity: 'clear' }),
        createMockTodo('2', { projectId: 'proj-2', projectConfidence: 0.8, clarity: 'clear' }),
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const needsClarification = selectTodosNeedingClarification(useSmartTodosStore.getState());

    expect(needsClarification).toHaveLength(0);
  });

  it('returns tasks with ambiguous clarity due to low confidence', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [
        createMockTodo('1', {
          projectId: 'proj-1',
          projectConfidence: 0.5, // Low confidence
          clarity: 'clear', // Parser says clear but we override
        }),
      ],
      suggestedOrder: ['1'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const needsClarification = selectTodosNeedingClarification(useSmartTodosStore.getState());

    expect(needsClarification).toHaveLength(1);
  });
});

describe('selectRoutableTodos', () => {
  beforeEach(() => {
    useSmartTodosStore.getState().reset();
  });

  it('returns tasks that are clear and have projectId', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [
        createMockTodo('1', { projectId: 'proj-1', projectConfidence: 0.9, clarity: 'clear' }),
        createMockTodo('2', { projectId: null, clarity: 'unknown_project' }),
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const routable = selectRoutableTodos(useSmartTodosStore.getState());

    expect(routable).toHaveLength(1);
    expect(routable[0].id).toBe('1');
  });

  it('excludes tasks with low confidence even if projectId exists', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [
        createMockTodo('1', { projectId: 'proj-1', projectConfidence: 0.5, clarity: 'clear' }),
      ],
      suggestedOrder: ['1'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const routable = selectRoutableTodos(useSmartTodosStore.getState());

    expect(routable).toHaveLength(0);
  });

  it('returns empty array when no tasks are routable', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [
        createMockTodo('1', { projectId: null, clarity: 'unknown_project' }),
        createMockTodo('2', { projectId: 'proj-2', projectConfidence: 0.3, clarity: 'ambiguous' }),
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const routable = selectRoutableTodos(useSmartTodosStore.getState());

    expect(routable).toHaveLength(0);
  });

  it('returns all tasks when all are routable', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [
        createMockTodo('1', { projectId: 'proj-1', projectConfidence: 0.9, clarity: 'clear' }),
        createMockTodo('2', { projectId: 'proj-2', projectConfidence: 0.8, clarity: 'clear' }),
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const routable = selectRoutableTodos(useSmartTodosStore.getState());

    expect(routable).toHaveLength(2);
  });
});

describe('selectTodoById', () => {
  beforeEach(() => {
    useSmartTodosStore.getState().reset();
  });

  it('returns task when found', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [createMockTodo('1'), createMockTodo('2')],
      suggestedOrder: ['1', '2'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const task = selectTodoById(useSmartTodosStore.getState(), '2');

    expect(task).toBeDefined();
    expect(task?.id).toBe('2');
  });

  it('returns undefined when task not found', () => {
    const todosResponse: ParsedTodosResponse = {
      todos: [createMockTodo('1')],
      suggestedOrder: ['1'],
    };
    useSmartTodosStore.getState().setParsedResult('session-1', todosResponse, false, null);

    const task = selectTodoById(useSmartTodosStore.getState(), 'nonexistent');

    expect(task).toBeUndefined();
  });

  it('returns undefined when no tasks exist', () => {
    const task = selectTodoById(useSmartTodosStore.getState(), '1');

    expect(task).toBeUndefined();
  });
});
