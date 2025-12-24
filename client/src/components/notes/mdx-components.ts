/**
 * MDX Component Descriptors for MDXEditor
 *
 * This file defines custom JSX components that can be used within MDX files.
 * Add new components here to make them available in the WYSIWYG editor.
 *
 * Example usage in MDX:
 * <Callout type="info" title="Note">This is a callout</Callout>
 */

import type { JsxComponentDescriptor } from '@mdxeditor/editor';

/**
 * Registry of JSX components available in the MDX editor.
 *
 * Each descriptor defines:
 * - name: The component tag name
 * - kind: 'flow' (block-level) or 'text' (inline)
 * - source: Import path (optional, for reference)
 * - props: Array of prop definitions for the editor UI
 * - hasChildren: Whether the component accepts children
 */
export const mdxComponentDescriptors: JsxComponentDescriptor[] = [
  {
    name: 'Callout',
    kind: 'flow',
    source: './components/Callout',
    props: [
      { name: 'type', type: 'string' },
      { name: 'title', type: 'string' },
    ],
    hasChildren: true,
    Editor: () => null, // Will use default block editor
  },
  {
    name: 'CodeDemo',
    kind: 'flow',
    source: './components/CodeDemo',
    props: [
      { name: 'language', type: 'string' },
      { name: 'showLineNumbers', type: 'expression' },
    ],
    hasChildren: true,
    Editor: () => null,
  },
  {
    name: 'Tabs',
    kind: 'flow',
    source: './components/Tabs',
    props: [
      { name: 'defaultTab', type: 'string' },
    ],
    hasChildren: true,
    Editor: () => null,
  },
  {
    name: 'Tab',
    kind: 'flow',
    source: './components/Tab',
    props: [
      { name: 'label', type: 'string' },
    ],
    hasChildren: true,
    Editor: () => null,
  },
  {
    name: 'Note',
    kind: 'flow',
    source: './components/Note',
    props: [
      { name: 'variant', type: 'string' }, // info, warning, error, success
    ],
    hasChildren: true,
    Editor: () => null,
  },
];

/**
 * Helper to get a component descriptor by name
 */
export function getComponentDescriptor(name: string): JsxComponentDescriptor | undefined {
  return mdxComponentDescriptors.find(c => c.name === name);
}
