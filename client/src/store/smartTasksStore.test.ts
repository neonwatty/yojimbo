import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSmartTasksStore,
  getEffectiveClarity,
  selectTasksNeedingClarification,
  selectRoutableTasks,
  selectTaskById,
} from './smartTasksStore';
import type { ParsedTask, ParsedTasksResponse, Project } from '@cc-orchestrator/shared';

const createMockTask = (id: string, overrides?: Partial<ParsedTask>): ParsedTask => ({
  id,
  originalText: `Original text for task ${id}`,
  title: `Task ${id}`,
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

describe('smartTasksStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSmartTasksStore.getState().reset();
  });

  describe('setAvailability', () => {
    it('sets isAvailable and availabilityMessage', () => {
      useSmartTasksStore.getState().setAvailability(true, 'Smart Tasks ready');

      expect(useSmartTasksStore.getState().isAvailable).toBe(true);
      expect(useSmartTasksStore.getState().availabilityMessage).toBe('Smart Tasks ready');
    });

    it('can set to unavailable with message', () => {
      useSmartTasksStore.getState().setAvailability(false, 'API key required');

      expect(useSmartTasksStore.getState().isAvailable).toBe(false);
      expect(useSmartTasksStore.getState().availabilityMessage).toBe('API key required');
    });
  });

  describe('setRawInput', () => {
    it('sets rawInput', () => {
      useSmartTasksStore.getState().setRawInput('Fix bug in auth module');

      expect(useSmartTasksStore.getState().rawInput).toBe('Fix bug in auth module');
    });

    it('can clear rawInput', () => {
      useSmartTasksStore.getState().setRawInput('Some input');
      useSmartTasksStore.getState().setRawInput('');

      expect(useSmartTasksStore.getState().rawInput).toBe('');
    });
  });

  describe('startParsing', () => {
    it('sets state to parsing and clears errorMessage', () => {
      // First set an error
      useSmartTasksStore.getState().setError('Previous error');

      useSmartTasksStore.getState().startParsing();

      expect(useSmartTasksStore.getState().state).toBe('parsing');
      expect(useSmartTasksStore.getState().errorMessage).toBeNull();
    });

    it('transitions from idle state', () => {
      expect(useSmartTasksStore.getState().state).toBe('idle');

      useSmartTasksStore.getState().startParsing();

      expect(useSmartTasksStore.getState().state).toBe('parsing');
    });
  });

  describe('setParsedResult', () => {
    it('sets parsed state with all fields', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1'), createMockTask('2')],
        suggestedOrder: ['1', '2'],
      };
      const summary = {
        totalTasks: 2,
        routableCount: 2,
        needsClarificationCount: 0,
        estimatedCost: '$0.05',
      };

      useSmartTasksStore.getState().setParsedResult('session-123', tasks, false, summary);

      const state = useSmartTasksStore.getState();
      expect(state.state).toBe('parsed');
      expect(state.sessionId).toBe('session-123');
      expect(state.parsedTasks).toEqual(tasks.tasks);
      expect(state.suggestedOrder).toEqual(['1', '2']);
      expect(state.needsClarification).toBe(false);
      expect(state.summary).toEqual(summary);
      expect(state.errorMessage).toBeNull();
    });

    it('sets needsClarification flag when true', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1', { clarity: 'ambiguous' })],
        suggestedOrder: ['1'],
      };
      const summary = {
        totalTasks: 1,
        routableCount: 0,
        needsClarificationCount: 1,
        estimatedCost: '$0.02',
      };

      useSmartTasksStore.getState().setParsedResult('session-456', tasks, true, summary);

      expect(useSmartTasksStore.getState().needsClarification).toBe(true);
    });

    it('clears previous error on success', () => {
      useSmartTasksStore.getState().setError('Old error');

      const tasks: ParsedTasksResponse = { tasks: [], suggestedOrder: [] };
      useSmartTasksStore.getState().setParsedResult('session-789', tasks, false, null);

      expect(useSmartTasksStore.getState().errorMessage).toBeNull();
    });
  });

  describe('startClarifying', () => {
    it('sets state to clarifying', () => {
      useSmartTasksStore.getState().startClarifying();

      expect(useSmartTasksStore.getState().state).toBe('clarifying');
    });
  });

  describe('setError', () => {
    it('sets state to error with message', () => {
      useSmartTasksStore.getState().setError('Failed to parse tasks');

      expect(useSmartTasksStore.getState().state).toBe('error');
      expect(useSmartTasksStore.getState().errorMessage).toBe('Failed to parse tasks');
    });
  });

  describe('updateTask', () => {
    it('updates a specific task', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1'), createMockTask('2')],
        suggestedOrder: ['1', '2'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().updateTask('1', { title: 'Updated Title' });

      expect(useSmartTasksStore.getState().parsedTasks[0].title).toBe('Updated Title');
    });

    it('does not modify other tasks', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1'), createMockTask('2')],
        suggestedOrder: ['1', '2'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().updateTask('1', { title: 'Updated' });

      expect(useSmartTasksStore.getState().parsedTasks[1].title).toBe('Task 2');
    });

    it('can update multiple fields at once', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1')],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().updateTask('1', {
        title: 'New Title',
        type: 'bug',
        projectConfidence: 0.5,
      });

      const task = useSmartTasksStore.getState().parsedTasks[0];
      expect(task.title).toBe('New Title');
      expect(task.type).toBe('bug');
      expect(task.projectConfidence).toBe(0.5);
    });

    it('does nothing if task not found', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1')],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().updateTask('nonexistent', { title: 'Nope' });

      expect(useSmartTasksStore.getState().parsedTasks[0].title).toBe('Task 1');
    });
  });

  describe('removeTask', () => {
    it('removes task from parsedTasks', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1'), createMockTask('2')],
        suggestedOrder: ['1', '2'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().removeTask('1');

      expect(useSmartTasksStore.getState().parsedTasks).toHaveLength(1);
      expect(useSmartTasksStore.getState().parsedTasks[0].id).toBe('2');
    });

    it('removes task from suggestedOrder', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1'), createMockTask('2'), createMockTask('3')],
        suggestedOrder: ['1', '2', '3'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().removeTask('2');

      expect(useSmartTasksStore.getState().suggestedOrder).toEqual(['1', '3']);
    });

    it('handles removing non-existent task gracefully', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1')],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().removeTask('nonexistent');

      expect(useSmartTasksStore.getState().parsedTasks).toHaveLength(1);
      expect(useSmartTasksStore.getState().suggestedOrder).toEqual(['1']);
    });
  });

  describe('selectProjectForTask', () => {
    it('updates projectId for a task', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1', { projectId: null, projectConfidence: 0 })],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().selectProjectForTask('1', 'new-project-id');

      expect(useSmartTasksStore.getState().parsedTasks[0].projectId).toBe('new-project-id');
    });

    it('updates projectConfidence from projectMatches when match found', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [
          createMockTask('1', {
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
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().selectProjectForTask('1', 'proj-a');

      expect(useSmartTasksStore.getState().parsedTasks[0].projectConfidence).toBe(0.85);
    });

    it('keeps existing confidence if project not in matches', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [
          createMockTask('1', {
            projectId: null,
            projectConfidence: 0.3,
            projectMatches: [{ projectId: 'proj-a', confidence: 0.9 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().selectProjectForTask('1', 'other-project');

      expect(useSmartTasksStore.getState().parsedTasks[0].projectConfidence).toBe(0.3);
    });

    it('updates clarity to clear when confidence >= 0.7 and projectId exists', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [
          createMockTask('1', {
            projectId: null,
            projectConfidence: 0,
            clarity: 'unknown_project',
            projectMatches: [{ projectId: 'proj-a', confidence: 0.8 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().selectProjectForTask('1', 'proj-a');

      expect(useSmartTasksStore.getState().parsedTasks[0].clarity).toBe('clear');
    });

    it('updates clarity to clear for unknown_project when selecting any project', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [
          createMockTask('1', {
            projectId: null,
            projectConfidence: 0.5, // Low confidence
            clarity: 'unknown_project',
            projectMatches: [{ projectId: 'proj-a', confidence: 0.5 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().selectProjectForTask('1', 'proj-a');

      // Should be clear because confidence (0.5) < 0.7 but we have a projectId
      // and the previous clarity was unknown_project
      expect(useSmartTasksStore.getState().parsedTasks[0].clarity).toBe('clear');
    });

    it('clears clarificationNeeded when clarity becomes clear', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [
          createMockTask('1', {
            projectId: null,
            projectConfidence: 0,
            clarity: 'unknown_project',
            clarificationNeeded: { question: 'Which project?' },
            projectMatches: [{ projectId: 'proj-a', confidence: 0.9 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().selectProjectForTask('1', 'proj-a');

      expect(useSmartTasksStore.getState().parsedTasks[0].clarificationNeeded).toBeUndefined();
    });

    it('preserves clarificationNeeded when clarity is not clear', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [
          createMockTask('1', {
            projectId: null,
            projectConfidence: 0.5,
            clarity: 'ambiguous',
            clarificationNeeded: { question: 'What do you mean?' },
            projectMatches: [{ projectId: 'proj-a', confidence: 0.5 }],
          }),
        ],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().selectProjectForTask('1', 'proj-a');

      // With confidence 0.5 >= 0.7 is false, but we have a projectId
      // Looking at the logic: newConfidence >= 0.7 && projectId -> no (0.5 < 0.7)
      // task.clarity === 'unknown_project' && projectId -> no (clarity is 'ambiguous')
      // So clarity stays 'ambiguous' and clarificationNeeded should be preserved
      expect(useSmartTasksStore.getState().parsedTasks[0].clarificationNeeded).toEqual({
        question: 'What do you mean?',
      });
    });

    it('does not modify other tasks', () => {
      const tasks: ParsedTasksResponse = {
        tasks: [
          createMockTask('1', { projectId: 'proj-1' }),
          createMockTask('2', { projectId: 'proj-2' }),
        ],
        suggestedOrder: ['1', '2'],
      };
      useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

      useSmartTasksStore.getState().selectProjectForTask('1', 'new-proj');

      expect(useSmartTasksStore.getState().parsedTasks[1].projectId).toBe('proj-2');
    });
  });

  describe('setProjects', () => {
    it('sets projects array', () => {
      const projects = [createMockProject('1'), createMockProject('2')];

      useSmartTasksStore.getState().setProjects(projects);

      expect(useSmartTasksStore.getState().projects).toEqual(projects);
    });

    it('can clear projects', () => {
      useSmartTasksStore.getState().setProjects([createMockProject('1')]);
      useSmartTasksStore.getState().setProjects([]);

      expect(useSmartTasksStore.getState().projects).toEqual([]);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      // Set various state
      useSmartTasksStore.getState().setAvailability(true, 'Ready');
      useSmartTasksStore.getState().setRawInput('Some input');
      const tasks: ParsedTasksResponse = {
        tasks: [createMockTask('1')],
        suggestedOrder: ['1'],
      };
      useSmartTasksStore
        .getState()
        .setParsedResult('session-1', tasks, true, { totalTasks: 1, routableCount: 1, needsClarificationCount: 0, estimatedCost: '$0.01' });
      useSmartTasksStore.getState().setProjects([createMockProject('1')]);

      // Reset
      useSmartTasksStore.getState().reset();

      // Verify initial state
      const state = useSmartTasksStore.getState();
      expect(state.isAvailable).toBe(false);
      expect(state.availabilityMessage).toBe('Checking availability...');
      expect(state.state).toBe('idle');
      expect(state.errorMessage).toBeNull();
      expect(state.rawInput).toBe('');
      expect(state.sessionId).toBeNull();
      expect(state.parsedTasks).toEqual([]);
      expect(state.suggestedOrder).toEqual([]);
      expect(state.needsClarification).toBe(false);
      expect(state.summary).toBeNull();
      expect(state.projects).toEqual([]);
    });
  });
});

describe('getEffectiveClarity', () => {
  it('returns unknown_project when projectId is null', () => {
    const task = createMockTask('1', {
      projectId: null,
      projectConfidence: 0.9,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('unknown_project');
  });

  it('returns ambiguous when projectConfidence < 0.7', () => {
    const task = createMockTask('1', {
      projectId: 'proj-1',
      projectConfidence: 0.5,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('ambiguous');
  });

  it('returns task clarity when projectId exists and confidence >= 0.7', () => {
    const task = createMockTask('1', {
      projectId: 'proj-1',
      projectConfidence: 0.8,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('clear');
  });

  it('returns ambiguous from parser when confidence >= 0.7 but parser says ambiguous', () => {
    const task = createMockTask('1', {
      projectId: 'proj-1',
      projectConfidence: 0.9,
      clarity: 'ambiguous',
    });

    expect(getEffectiveClarity(task)).toBe('ambiguous');
  });

  it('returns ambiguous at exactly 0.7 confidence threshold', () => {
    const task = createMockTask('1', {
      projectId: 'proj-1',
      projectConfidence: 0.7,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('clear');
  });

  it('returns ambiguous just below 0.7 threshold', () => {
    const task = createMockTask('1', {
      projectId: 'proj-1',
      projectConfidence: 0.69,
      clarity: 'clear',
    });

    expect(getEffectiveClarity(task)).toBe('ambiguous');
  });
});

describe('selectTasksNeedingClarification', () => {
  beforeEach(() => {
    useSmartTasksStore.getState().reset();
  });

  it('returns tasks where effective clarity is not clear', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [
        createMockTask('1', { projectId: null, clarity: 'clear' }), // Will be unknown_project
        createMockTask('2', { projectId: 'proj-2', projectConfidence: 0.9, clarity: 'clear' }), // Clear
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const needsClarification = selectTasksNeedingClarification(useSmartTasksStore.getState());

    expect(needsClarification).toHaveLength(1);
    expect(needsClarification[0].id).toBe('1');
  });

  it('returns tasks with clarificationNeeded even if clarity is clear', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [
        createMockTask('1', {
          projectId: 'proj-1',
          projectConfidence: 0.9,
          clarity: 'clear',
          clarificationNeeded: { question: 'Is this urgent?' },
        }),
      ],
      suggestedOrder: ['1'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const needsClarification = selectTasksNeedingClarification(useSmartTasksStore.getState());

    expect(needsClarification).toHaveLength(1);
    expect(needsClarification[0].id).toBe('1');
  });

  it('returns empty array when all tasks are clear', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [
        createMockTask('1', { projectId: 'proj-1', projectConfidence: 0.9, clarity: 'clear' }),
        createMockTask('2', { projectId: 'proj-2', projectConfidence: 0.8, clarity: 'clear' }),
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const needsClarification = selectTasksNeedingClarification(useSmartTasksStore.getState());

    expect(needsClarification).toHaveLength(0);
  });

  it('returns tasks with ambiguous clarity due to low confidence', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [
        createMockTask('1', {
          projectId: 'proj-1',
          projectConfidence: 0.5, // Low confidence
          clarity: 'clear', // Parser says clear but we override
        }),
      ],
      suggestedOrder: ['1'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const needsClarification = selectTasksNeedingClarification(useSmartTasksStore.getState());

    expect(needsClarification).toHaveLength(1);
  });
});

describe('selectRoutableTasks', () => {
  beforeEach(() => {
    useSmartTasksStore.getState().reset();
  });

  it('returns tasks that are clear and have projectId', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [
        createMockTask('1', { projectId: 'proj-1', projectConfidence: 0.9, clarity: 'clear' }),
        createMockTask('2', { projectId: null, clarity: 'unknown_project' }),
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const routable = selectRoutableTasks(useSmartTasksStore.getState());

    expect(routable).toHaveLength(1);
    expect(routable[0].id).toBe('1');
  });

  it('excludes tasks with low confidence even if projectId exists', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [
        createMockTask('1', { projectId: 'proj-1', projectConfidence: 0.5, clarity: 'clear' }),
      ],
      suggestedOrder: ['1'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const routable = selectRoutableTasks(useSmartTasksStore.getState());

    expect(routable).toHaveLength(0);
  });

  it('returns empty array when no tasks are routable', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [
        createMockTask('1', { projectId: null, clarity: 'unknown_project' }),
        createMockTask('2', { projectId: 'proj-2', projectConfidence: 0.3, clarity: 'ambiguous' }),
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const routable = selectRoutableTasks(useSmartTasksStore.getState());

    expect(routable).toHaveLength(0);
  });

  it('returns all tasks when all are routable', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [
        createMockTask('1', { projectId: 'proj-1', projectConfidence: 0.9, clarity: 'clear' }),
        createMockTask('2', { projectId: 'proj-2', projectConfidence: 0.8, clarity: 'clear' }),
      ],
      suggestedOrder: ['1', '2'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const routable = selectRoutableTasks(useSmartTasksStore.getState());

    expect(routable).toHaveLength(2);
  });
});

describe('selectTaskById', () => {
  beforeEach(() => {
    useSmartTasksStore.getState().reset();
  });

  it('returns task when found', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [createMockTask('1'), createMockTask('2')],
      suggestedOrder: ['1', '2'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const task = selectTaskById(useSmartTasksStore.getState(), '2');

    expect(task).toBeDefined();
    expect(task?.id).toBe('2');
  });

  it('returns undefined when task not found', () => {
    const tasks: ParsedTasksResponse = {
      tasks: [createMockTask('1')],
      suggestedOrder: ['1'],
    };
    useSmartTasksStore.getState().setParsedResult('session-1', tasks, false, null);

    const task = selectTaskById(useSmartTasksStore.getState(), 'nonexistent');

    expect(task).toBeUndefined();
  });

  it('returns undefined when no tasks exist', () => {
    const task = selectTaskById(useSmartTasksStore.getState(), '1');

    expect(task).toBeUndefined();
  });
});
