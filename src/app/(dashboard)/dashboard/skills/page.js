"use client";

import { translate } from "@/i18n/runtime";
import { useSyncExternalStore } from "react";
import { Card, Badge } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { SKILLS, getSkillPath, getSkillRawUrl } from "@/shared/constants/skills";

// The copied URL has to be absolute: the agent that fetches it is not running
// in this browser. The origin is only knowable on the client, so the server
// snapshot is empty and React swaps in the real value after hydration. It never
// changes, hence the no-op subscribe.
const noopSubscribe = () => () => {};
const clientOrigin = () => window.location.origin;
const serverOrigin = () => "";

function useOrigin() {
  return useSyncExternalStore(noopSubscribe, clientOrigin, serverOrigin);
}

function CopyButton({ value, label = translate("Copy link") }) {
  const { copied, copy } = useCopyToClipboard(2000);
  return (
    <button
      onClick={() => copy(value)}
      className="px-2 py-1 rounded-md bg-primary text-on-primary text-[11px] font-medium hover:bg-primary/90 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1"
      title={value}
    >
      <span className="material-symbols-outlined text-[12px]">
        {copied ? "check" : "content_copy"}
      </span>
      {copied ? "Copied!" : label}
    </button>
  );
}

function SkillRow({ skill, origin }) {
  const path = getSkillPath(skill.id);
  // Before mount `origin` is empty, so this renders the same path the server
  // did, then upgrades to the absolute URL the user actually needs to copy.
  const url = getSkillRawUrl(skill.id, origin);
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-[14px] border shadow-[var(--shadow-soft)] transition-colors ${
        skill.isEntry
          ? "border-brand-500/40 bg-brand-500/5"
          : "border-border-subtle bg-surface hover:bg-surface-2"
      }`}
    >
      <div
        className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
          skill.isEntry ? "bg-primary text-on-primary" : "bg-primary/10 text-primary"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">{skill.icon}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm text-text-main">{skill.name}</h3>
          {skill.isEntry && (
            <Badge variant="primary" size="sm">{translate("START HERE")}</Badge>
          )}
          {skill.endpoint && (
            <Badge variant="default" size="sm">
              <code className="text-[10px]">{skill.endpoint}</code>
            </Badge>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5">{skill.description}</p>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-text-muted hover:text-primary mt-1 inline-flex items-center gap-1 break-all"
        >
          {url}
          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
        </a>
      </div>

      <CopyButton value={url} />
    </div>
  );
}

export default function SkillsPage() {
  const origin = useOrigin();
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card padding="md">
        <div className="text-xs text-text-muted mb-2">{translate("Paste this to your AI:")}</div>
        <div className="px-3 py-2 rounded bg-surface-2 font-mono text-[12px] text-text-main">
          Read this skill and use it: {getSkillRawUrl("NovaRoute", origin)}
        </div>
      </Card>

      <div className="space-y-2">
        {SKILLS.map((skill) => (
          <SkillRow key={skill.id} skill={skill} origin={origin} />
        ))}
      </div>

      <Card padding="md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-text-main">{translate("Where these come from")}</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Every skill above is served by this instance from the files bundled
              with your build, under <code>skills/</code> in the source tree.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
