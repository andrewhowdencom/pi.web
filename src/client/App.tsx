import React from "react";
import { useAgent } from "./store.js";
import { MessageList } from "./components/MessageList.js";
import { InputArea } from "./components/InputArea.js";
import { StatusBar } from "./components/StatusBar.js";
import { ExtensionUIDialog } from "./components/ExtensionUIDialog.js";
import { ExtensionUINotifications } from "./components/ExtensionUINotifications.js";

export default function App() {
  const agent = useAgent();

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
      <header className="app-header">
        <h1>pi web</h1>
        <StatusBar
          connected={agent.connected}
          model={agent.agentState?.model ?? null}
          thinkingLevel={agent.agentState?.thinkingLevel ?? null}
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
