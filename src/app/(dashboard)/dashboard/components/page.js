"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";
import Select from "@/shared/components/Select";
import Input from "@/shared/components/Input";

const CATEGORIES = [
  { id: "all", label: "All", icon: "apps" },
  { id: "layout", label: "Layout", icon: "view_column" },
  { id: "form", label: "Form", icon: "edit_note" },
  { id: "data", label: "Data", icon: "table_chart" },
  { id: "feedback", label: "Feedback", icon: "info" },
];

const COMPONENTS = [
  {
    id: "card",
    name: "Card",
    category: "layout",
    description: "Container with optional title, subtitle, icon, and action slot",
    props: ["children", "title", "subtitle", "icon", "action", "padding", "hover", "elev"],
  },
  {
    id: "badge",
    name: "Badge",
    category: "data",
    description: "Status indicator with variant, size, dot, and icon support",
    props: ["children", "variant", "size", "dot", "icon"],
  },
  {
    id: "button",
    name: "Button",
    category: "form",
    description: "Action button with gradient primary, ghost, outline, and danger variants",
    props: ["children", "variant", "size", "icon", "iconRight", "disabled", "loading", "fullWidth"],
  },
  {
    id: "toggle",
    name: "Toggle",
    category: "form",
    description: "Accessible switch with label, description, and three sizes",
    props: ["checked", "onChange", "label", "description", "disabled", "size"],
  },
  {
    id: "select",
    name: "Select",
    category: "form",
    description: "Dropdown with label, options, error state, and hint text",
    props: ["label", "options", "value", "onChange", "placeholder", "error", "hint", "disabled"],
  },
  {
    id: "input",
    name: "Input",
    category: "form",
    description: "Text input with label, icon, error state, and hint text",
    props: ["label", "type", "placeholder", "value", "onChange", "error", "hint", "icon", "disabled"],
  },
  {
    id: "card-skeleton",
    name: "CardSkeleton",
    category: "feedback",
    description: "Loading placeholder for card content",
    props: ["className"],
  },
];

function ComponentDemo({ component }) {
  const [toggleState, setToggleState] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [selectValue, setSelectValue] = useState("option1");

  const demos = {
    card: (
      <Card title="Card Title" subtitle="Optional subtitle text" icon="dashboard" action={<Button variant="ghost" size="sm">Action</Button>}>
        <p className="text-sm text-text-muted">Card body content goes here. Cards support hover, elevation, and padding variants.</p>
      </Card>
    ),
    badge: (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" size="sm">Default</Badge>
        <Badge variant="primary" size="md">Primary</Badge>
        <Badge variant="success" size="lg" dot>Success</Badge>
        <Badge variant="warning" size="md" dot>Warning</Badge>
        <Badge variant="error" size="sm" dot>Error</Badge>
        <Badge variant="info" size="md" icon="info">Info</Badge>
      </div>
    ),
    button: (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm">Primary SM</Button>
        <Button variant="primary" size="md" icon="save">With Icon</Button>
        <Button variant="secondary" size="md">Secondary</Button>
        <Button variant="outline" size="md">Outline</Button>
        <Button variant="ghost" size="md">Ghost</Button>
        <Button variant="danger" size="md" icon="delete">Danger</Button>
        <Button variant="success" size="md" icon="check">Success</Button>
        <Button variant="primary" size="sm" loading>Loading</Button>
      </div>
    ),
    toggle: (
      <div className="space-y-4">
        <Toggle checked={toggleState} onChange={setToggleState} label="Enable feature" description="Toggle this setting on or off" />
        <Toggle checked={!toggleState} onChange={() => setToggleState(!toggleState)} size="sm" label="Small toggle" />
        <Toggle checked={false} disabled label="Disabled toggle" />
      </div>
    ),
    select: (
      <div className="max-w-xs">
        <Select
          label="Choose option"
          options={[
            { value: "option1", label: "Option One" },
            { value: "option2", label: "Option Two" },
            { value: "option3", label: "Option Three" },
          ]}
          value={selectValue}
          onChange={(e) => setSelectValue(e.target.value)}
          hint="Select from the dropdown"
        />
      </div>
    ),
    input: (
      <div className="max-w-xs space-y-4">
        <Input
          label="Email"
          placeholder="you@example.com"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          icon="mail"
          hint="We'll never share your email"
        />
        <Input
          label="With Error"
          placeholder="Enter value"
          error="This field is required"
        />
      </div>
    ),
    "card-skeleton": (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton className="h-32" />
      </div>
    ),
  };

  return demos[component.id] || <p className="text-sm text-text-muted">No demo available</p>;
}

export default function ComponentsPage() {
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const filtered = COMPONENTS.filter((c) => {
    const matchCat = category === "all" || c.category === category;
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const categoryCounts = COMPONENTS.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <CardSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Components</h1>
          <p className="text-sm text-text-muted mt-1">Reusable UI component library showcase</p>
        </div>
        <Badge variant="default" size="md">{COMPONENTS.length} components</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CATEGORIES.slice(1).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${
              category === cat.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border-subtle bg-surface hover:bg-surface-2 text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{cat.icon}</span>
            <span className="text-sm font-medium">{cat.label}</span>
            <span className="ml-auto text-xs opacity-60">{categoryCounts[cat.id] || 0}</span>
          </button>
        ))}
      </div>

      <Input
        placeholder="Search components..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-1 border-b border-surface-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              category === cat.id
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
          <span className="material-symbols-outlined text-[36px] text-text-muted">search_off</span>
          <p className="text-sm text-text-muted">No components match your search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((comp) => (
            <Card key={comp.id} className="p-0 overflow-hidden">
              <div className="p-5 border-b border-border-subtle">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-text-main">{comp.name}</h3>
                    <Badge variant="default" size="sm">{comp.category}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {comp.props.map((p) => (
                      <Badge key={p} variant="default" size="sm">{p}</Badge>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-text-muted mt-1">{comp.description}</p>
              </div>
              <div className="p-5 bg-bg">
                <ComponentDemo component={comp} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
