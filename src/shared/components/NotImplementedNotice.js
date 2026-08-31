"use client";

import PropTypes from "prop-types";
import { translate } from "@/i18n/runtime";

/**
 * Shown on a panel whose API answers `implemented: false`. A control that
 * animates on click and quietly forgets the setting is worse than one that
 * says it is not wired up yet, so these panels say so.
 */
export default function NotImplementedNotice({ feature }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
      <span className="material-symbols-outlined text-[18px] text-warning">construction</span>
      <p className="text-xs leading-relaxed text-text-muted">
        {translate("This panel is not connected to a backend yet — changes here are not saved.")}
        {feature ? ` (${feature})` : ""}
      </p>
    </div>
  );
}

NotImplementedNotice.propTypes = {
  feature: PropTypes.string,
};
