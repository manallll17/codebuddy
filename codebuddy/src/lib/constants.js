export const LANGUAGES = [
  {
    id: 'python', label: 'Python', monaco: 'python', ext: ['py'],
    starter: 'name = input("Enter your name: ")\nprint(f"Hello, {name}! Welcome to CodeBuddy")\n',
  },
  {
    id: 'java', label: 'Java', monaco: 'java', ext: ['java'],
    starter: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CodeBuddy!");\n    }\n}\n',
  },
  {
    id: 'c', label: 'C', monaco: 'c', ext: ['c', 'h'],
    starter: '#include <stdio.h>\n\nint main() {\n    printf("Hello, CodeBuddy!\\n");\n    return 0;\n}\n',
  },
  {
    id: 'cpp', label: 'C++', monaco: 'cpp', ext: ['cpp', 'cc', 'hpp'],
    starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, CodeBuddy!" << endl;\n    return 0;\n}\n',
  },
  {
    id: 'javascript', label: 'JavaScript', monaco: 'javascript', ext: ['js'],
    starter: 'console.log("Hello, CodeBuddy!");\n',
  },
];

export const langById = (id) => LANGUAGES.find((l) => l.id === id) || LANGUAGES[0];
export const langFromFile = (name = '') => {
  const ext = name.split('.').pop().toLowerCase();
  return LANGUAGES.find((l) => l.ext.includes(ext))?.id;
};
export const CODE_EXTENSIONS = LANGUAGES.flatMap((l) => l.ext.map((e) => '.' + e)).concat(['.txt']).join(',');

export const LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

export const MODES = [
  { id: 'chat', label: '💬 Ask', placeholder: 'Ask CodeBuddy anything about programming…' },
  { id: 'explain', label: '💡 Explain', placeholder: 'Which concept should I explain? e.g. recursion' },
  { id: 'debug', label: '🐞 Debug', placeholder: 'Paste your code (and the error message) here…' },
  { id: 'linebyline', label: '📜 Line by line', placeholder: 'Paste code to explain line by line…' },
  { id: 'optimize', label: '⚡ Optimise', placeholder: 'Paste code you want to make faster / cleaner…' },
  { id: 'practice', label: '🎯 Practice', placeholder: 'Topic for a practice question, e.g. arrays' },
];

export const ROOMS = [
  { id: 'general', label: 'general', desc: 'Say hi and chat about anything code' },
  { id: 'doubts', label: 'doubts', desc: 'Stuck? Ask the community' },
  { id: 'python', label: 'python', desc: 'Python help & tips' },
  { id: 'java', label: 'java', desc: 'Java help & tips' },
  { id: 'c', label: 'c', desc: 'C programming' },
  { id: 'cpp', label: 'cpp', desc: 'C++ & DSA' },
  { id: 'javascript', label: 'javascript', desc: 'JS & web dev' },
];

const common = (lang) => [
  { id: 'basics', title: 'Syntax & Variables', desc: `How a ${lang} program is structured, variables and data types` },
  { id: 'io', title: 'Input & Output', desc: 'Reading input and printing formatted output' },
  { id: 'operators', title: 'Operators & Expressions', desc: 'Arithmetic, comparison and logical operators' },
  { id: 'conditions', title: 'Conditionals', desc: 'if / else and decision making' },
  { id: 'loops', title: 'Loops', desc: 'for, while and loop control' },
  { id: 'functions', title: 'Functions', desc: 'Parameters, return values and scope' },
];

export const ROADMAPS = {
  python: [...common('Python'),
    { id: 'collections', title: 'Lists, Tuples & Dicts', desc: 'Python built-in collections' },
    { id: 'strings', title: 'String Handling', desc: 'Slicing, methods and f-strings' },
    { id: 'files', title: 'File Handling & Exceptions', desc: 'open(), with, try / except' },
    { id: 'oop', title: 'OOP in Python', desc: 'Classes, objects, inheritance' },
  ],
  java: [...common('Java'),
    { id: 'arrays', title: 'Arrays & ArrayList', desc: 'Storing collections of data' },
    { id: 'strings', title: 'Strings & StringBuilder', desc: 'Immutable strings and efficient building' },
    { id: 'oop', title: 'Classes & Objects', desc: 'Constructors, encapsulation, inheritance, polymorphism' },
    { id: 'exceptions', title: 'Exception Handling', desc: 'try / catch / finally, custom exceptions' },
  ],
  c: [...common('C'),
    { id: 'arrays', title: 'Arrays & Strings', desc: 'char arrays and string.h' },
    { id: 'pointers', title: 'Pointers', desc: 'Addresses, dereferencing, pointer arithmetic' },
    { id: 'structs', title: 'Structures', desc: 'struct, typedef, arrays of structs' },
    { id: 'memory', title: 'Dynamic Memory', desc: 'malloc, calloc, free' },
  ],
  cpp: [...common('C++'),
    { id: 'arrays', title: 'Arrays & Vectors', desc: 'std::vector and iteration' },
    { id: 'oop', title: 'Classes & Objects', desc: 'Constructors, inheritance, virtual functions' },
    { id: 'stl', title: 'STL Containers', desc: 'map, set, stack, queue' },
    { id: 'pointers', title: 'Pointers & References', desc: 'new/delete, smart pointers' },
  ],
  javascript: [...common('JavaScript'),
    { id: 'arrays', title: 'Arrays & Objects', desc: 'map, filter, reduce, destructuring' },
    { id: 'dom', title: 'DOM Manipulation', desc: 'Selecting and changing page elements' },
    { id: 'async', title: 'Async JS', desc: 'Callbacks, promises, async/await' },
    { id: 'es6', title: 'Modern ES6+', desc: 'Arrow functions, modules, classes' },
  ],
};

export const PROJECT_ROLES = ['owner', 'editor', 'viewer'];
export const ROLE_INFO = {
  owner: 'Full control: invite/remove members, ask AI, edit files',
  editor: 'Ask AI, pin answers, edit files, chat',
  viewer: 'Read everything and join the team chat',
};
