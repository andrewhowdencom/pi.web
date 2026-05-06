import React, { useState } from "react";
import { useAgent } from "./store.js";
import { MessageList } from "./components/MessageList.js";
import { InputArea } from "./components/InputArea.js";
import { StatusPill } from "./components/StatusPill.js";
import { StatusDetails } from "./components/StatusDetails.js";
import { ExtensionUIDialog } from "./components/ExtensionUIDialog.js";
import { ExtensionUINotifications } from "./components/ExtensionUINotifications.js";

export default function App() {
  const agent = useAgent();
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <div className="app">
      <ExtensionUINotifications
        notifications={agent.notifications}
        onDismiss={agent.dismissNotification}
      />
      {agent.pendingUIRequests.length > 0 && (
        <ExtensionUIDialog
          request={agent.pendingUIRequests[0]}
          onResponse={(id, response) =>
            agent.sendExtensionUIResponse(id, response)
          }
          onCancel={(id) =>
            agent.sendExtensionUIResponse(id, { cancelled: true })
          }
        />
      )}
      <StatusDetails
        isOpen={statusOpen}
        onClose={() => setStatusOpen(false)}
        agentState={agent.agentState}
        statuses={agent.statuses}
        activeToolCalls={agent.activeToolCalls}
      />
      <header className="app-header">
        <h1>pi web</h1>
        <StatusPill
          connected={agent.connected}
          model={agent.agentState?.model ?? null}
          isStreaming={agent.isStreaming}
          isCompacting={agent.agentState?.isCompacting ?? false}
          activeToolCount={agent.activeToolCalls.size}
          pendingMessageCount={agent.agentState?.pendingMessageCount ?? 0}
          onClick={() => setStatusOpen(true)}
        />
      </header>
      <main className="app-main">
        <MessageList
          messages={agent.messages}
          isStreaming={agent.isStreaming}
        />
      </main>
      <footer className="app-footer">
        <InputArea
          connected={agent.connected}
          isStreaming={agent.isStreaming}
          onSend={agent.sendPrompt}
          onSteer={agent.sendSteer}
          onAbort={agent.sendAbort}
          onSlashCommand={agent.sendSlashCommand}
        />
      </footer>
    </div>
  );
}
