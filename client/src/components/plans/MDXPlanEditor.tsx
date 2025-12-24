import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertTable,
  InsertCodeBlock,
  ListsToggle,
  UndoRedo,
  Separator,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { useSettingsStore } from '../../store/settingsStore';

export interface MDXPlanEditorProps {
  markdown: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export interface MDXPlanEditorRef {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
}

export const MDXPlanEditor = forwardRef<MDXPlanEditorRef, MDXPlanEditorProps>(
  ({ markdown, onChange, readOnly = false, placeholder }, ref) => {
    const { theme } = useSettingsStore();
    const editorRef = useRef<MDXEditorMethods>(null);

    useImperativeHandle(ref, () => ({
      getMarkdown: () => editorRef.current?.getMarkdown() || '',
      setMarkdown: (md: string) => editorRef.current?.setMarkdown(md),
      focus: () => editorRef.current?.focus(),
    }));

    // Update editor when markdown prop changes externally
    useEffect(() => {
      if (editorRef.current) {
        const currentContent = editorRef.current.getMarkdown();
        if (currentContent !== markdown) {
          editorRef.current.setMarkdown(markdown);
        }
      }
    }, [markdown]);

    return (
      <div className={`mdx-editor-wrapper ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`}>
        <MDXEditor
          ref={editorRef}
          markdown={markdown}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          contentEditableClassName="mdx-editor-content"
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            imagePlugin(),
            tablePlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: 'typescript' }),
            codeMirrorPlugin({
              codeBlockLanguages: {
                js: 'JavaScript',
                javascript: 'JavaScript',
                ts: 'TypeScript',
                typescript: 'TypeScript',
                jsx: 'JSX',
                tsx: 'TSX',
                css: 'CSS',
                html: 'HTML',
                json: 'JSON',
                python: 'Python',
                bash: 'Bash',
                sh: 'Shell',
                sql: 'SQL',
                yaml: 'YAML',
                markdown: 'Markdown',
                md: 'Markdown',
                '': 'Plain Text',
              },
            }),
            markdownShortcutPlugin(),
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <UndoRedo />
                  <Separator />
                  <BlockTypeSelect />
                  <Separator />
                  <BoldItalicUnderlineToggles />
                  <Separator />
                  <ListsToggle />
                  <Separator />
                  <CreateLink />
                  <InsertTable />
                  <InsertCodeBlock />
                </>
              ),
            }),
          ]}
        />
      </div>
    );
  }
);

MDXPlanEditor.displayName = 'MDXPlanEditor';
