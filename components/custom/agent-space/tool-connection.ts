import axios from "axios";

type ConnectionStatus = { isConnected: boolean };
type ConnectResponse = { redirectUrl: string };

const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 720;
const CONNECTION_CHECK_INTERVAL_MS = 1500;
const MAX_CONNECTION_CHECKS = 400;

export async function connectToolInPopup(agentId: string, toolkitSlug: string) {
  const left = Math.max(
    0,
    window.screenX + (window.outerWidth - POPUP_WIDTH) / 2,
  );
  const top = Math.max(
    0,
    window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2,
  );
  const popup = window.open(
    "about:blank",
    `composio-auth-${toolkitSlug}`,
    `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );

  if (!popup) {
    throw new Error("Allow pop-ups for this site to connect your app.");
  }

  try {
    const { data } = await axios.post<ConnectResponse>("/api/tools/connect", {
      agentId,
      toolkitSlug,
    });
    popup.location.replace(data.redirectUrl);
  } catch (error) {
    popup.close();
    throw error;
  }

  return new Promise<boolean>((resolve) => {
    let checks = 0;
    let checksAfterClose = 0;
    let checking = false;

    const timer = window.setInterval(async () => {
      if (checking) return;
      checking = true;
      checks += 1;

      try {
        const { data } = await axios.get<ConnectionStatus>("/api/tools/status", {
          params: { agentId, toolkitSlug },
        });

        if (data.isConnected) {
          window.clearInterval(timer);
          if (!popup.closed) popup.close();
          resolve(true);
          return;
        }

        if (popup.closed) checksAfterClose += 1;
        if (checksAfterClose >= 4 || checks >= MAX_CONNECTION_CHECKS) {
          window.clearInterval(timer);
          resolve(false);
        }
      } catch {
        if (popup.closed) checksAfterClose += 1;
        if (checksAfterClose >= 4 || checks >= MAX_CONNECTION_CHECKS) {
          window.clearInterval(timer);
          resolve(false);
        }
      } finally {
        checking = false;
      }
    }, CONNECTION_CHECK_INTERVAL_MS);
  });
}
