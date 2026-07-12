"use client";

import { useCallback, useEffect, useState } from "react";
import { gmailClient } from "@/services/gmail-client";
import { twilioClient } from "@/services/twilio-client";
import { whatsappClient } from "@/services/whatsapp-client";
import type { IntegrationRequirement } from "@/lib/automation/definitions";

export type IntegrationStatusState = {
  loading: boolean;
  gmail: {
    connected: boolean;
    needsReconnect: boolean;
    reconnectUrl: string;
  };
  whatsapp: {
    connected: boolean;
    encryptionReady: boolean;
  };
  twilio: {
    connected: boolean;
    encryptionReady: boolean;
  };
};

const initial: IntegrationStatusState = {
  loading: true,
  gmail: { connected: false, needsReconnect: false, reconnectUrl: "" },
  whatsapp: { connected: false, encryptionReady: false },
  twilio: { connected: false, encryptionReady: false },
};

export function useIntegrationStatus() {
  const [status, setStatus] = useState<IntegrationStatusState>(initial);

  const refresh = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true }));
    try {
      const [gmail, whatsapp, twilio] = await Promise.all([
        gmailClient.getStatus(),
        whatsappClient.getStatus(),
        twilioClient.getStatus(),
      ]);
      setStatus({
        loading: false,
        gmail: {
          connected: Boolean(gmail.account?.status === "ACTIVE"),
          needsReconnect:
            Boolean(gmail.account) &&
            (!gmail.sheetsScopesGranted ||
              gmail.oauthProjectMismatch ||
              gmail.refreshTokenInvalid ||
              Boolean(gmail.needsReconnect)),
          reconnectUrl: gmail.reconnectUrl,
        },
        whatsapp: {
          connected: Boolean(whatsapp.account?.status === "ACTIVE"),
          encryptionReady: whatsapp.configured.encryption,
        },
        twilio: {
          connected: Boolean(twilio.account?.status === "ACTIVE"),
          encryptionReady: twilio.configured.encryption,
        },
      });
    } catch {
      setStatus({ ...initial, loading: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isConnected = useCallback(
    (req: IntegrationRequirement) => {
      if (req === "GMAIL") {
        return status.gmail.connected && !status.gmail.needsReconnect;
      }
      if (req === "TWILIO") return status.twilio.connected;
      return status.whatsapp.connected;
    },
    [status]
  );

  return { status, refresh, isConnected };
}
