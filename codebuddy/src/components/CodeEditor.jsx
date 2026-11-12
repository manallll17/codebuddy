import Editor from '@monaco-editor/react';
import { useSettings } from '../context/SettingsContext';
import { langById } from '../lib/constants';
import Spinner from './Spinner';

// VS Code's Monaco editor with syntax highlighting
export default function CodeEditor({ value, onChange, language = 'python', height = '100%', readOnly = false }) {
  const { theme } = useSettings();
  return (
    <div className="editor-wrap" style={{ height }}>
      <Editor
        height="100%"
        language={langById(language).monaco}
        value={value}
        onChange={(v) => onChange?.(v ?? '')}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        loading={<Spinner label="Loading editor…" />}
        options={{
          readOnly,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          padding: { top: 12 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
        }}
      />
    </div>
  );
}
