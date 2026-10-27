
import { APP_VERSION, BUILD_DATE } from "@/utils/appInfo";
import { useState, useEffect } from "react";
import { SessionControl } from "@/components/settings/SessionControl";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { PrivacyNoticeDialog } from "@/components/PrivacyNoticeDialog";
import { PWAInstallSection } from "@/components/settings/PWAInstallSection";
// FIX: Import from shadcn/ui location for Button
import { Button } from "@/components/ui/button";

export default function Settings() {
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const handleClearData = () => {
    if (confirm("Are you sure? All app data (players, scores, history) will be deleted. This cannot be undone.")) {
      localStorage.clear();
      indexedDB.deleteDatabase("ShuttleSessionDB");
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 w-full col-span-full">
      <div>
        <h1 className="text-2xl font-bold mb-2 text-shuttle-lightBlue">Settings</h1>
        <p className="text-shuttle-lightBlue">Configure application settings</p>
      </div>
      
      {/* Session Control Section */}
      <SessionControl />
      
      {/* General Settings Section */}
      <GeneralSettings />

      {/* PWA Install Section */}
      <PWAInstallSection />

      {/* Privacy & Data Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <h2 className="text-xl font-semibold mb-3 text-foreground">Privacy & Data</h2>
        <div className="flex gap-4">
          <Button onClick={handleClearData} className="bg-red-500 text-white">
            Clear All Data
          </Button>
          <Button onClick={() => setPrivacyOpen(true)} variant="outline">
            Privacy Notice
          </Button>
        </div>
        <PrivacyNoticeDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      </div>

      {/* Version Info Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <h2 className="text-xl font-semibold mb-3 text-foreground">App Information</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between items-center">
            <span>Version:</span>
            <span className="font-mono">{APP_VERSION}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Last Updated:</span>
            <span className="font-mono">
              {BUILD_DATE ? BUILD_DATE.toLocaleDateString() : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
