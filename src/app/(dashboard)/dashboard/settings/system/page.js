"use client";
import { useState, useEffect } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";

export default function SystemSettingsPage() {
  const [version, setVersion] = useState("...");
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState([]);
  const [updateResult, setUpdateResult] = useState(null);

  const checkUpdate = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/setup/check-update");
      const data = await res.json();
      setUpdateInfo(data);
      setVersion(data.current || "unknown");
    } catch {
      setVersion("unknown");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkUpdate();
  }, []);

  const handleUpdate = async () => {
    if (!confirm("Are you sure you want to update NovaRoute? This will restart the service.")) return;
    setUpdating(true);
    setUpdateLogs(["Starting update..."]);
    setUpdateResult(null);
    try {
      const res = await fetch("/api/setup/update", { method: "POST" });
      const data = await res.json();
      setUpdateLogs(data.logs || []);
      setUpdateResult(data.success ? "success" : "error");
      if (data.success) {
        // Re-check version after update
        setTimeout(checkUpdate, 3000);
      }
    } catch (err) {
      setUpdateLogs([`Error: ${err.message}`]);
      setUpdateResult("error");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500">system_update</span>
          System & Update
        </h2>

        <div className="space-y-4">
          {/* Version info */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Current Version</p>
              <p className="text-xl font-mono font-bold">{version}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Status</p>
              {updateInfo?.updateAvailable ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  Update Available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Up to Date
                </span>
              )}
            </div>
          </div>

          {/* Latest commit info */}
          {updateInfo?.commitSha && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <p className="text-blue-700">
                <span className="font-mono">{updateInfo.commitSha}</span> — {updateInfo.commitMessage}
              </p>
              {updateInfo.commitDate && (
                <p className="text-blue-500 text-xs mt-1">{new Date(updateInfo.commitDate).toLocaleString()}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-4 flex gap-3">
            <Button
              onClick={checkUpdate}
              disabled={checking}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
            >
              {checking ? "Checking..." : "Check for Updates"}
            </Button>

            <Button
              onClick={handleUpdate}
              disabled={updating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
            >
              {updating ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span> Updating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">download</span>
                  Update Now
                </span>
              )}
            </Button>
          </div>

          {/* Update log */}
          {updateLogs.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Update Log</h3>
              <div className={`p-4 rounded-lg text-sm font-mono max-h-64 overflow-y-auto ${
                updateResult === "success" ? "bg-green-50 text-green-800" :
                updateResult === "error" ? "bg-red-50 text-red-800" :
                "bg-gray-50 text-gray-800"
              }`}>
                {updateLogs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
