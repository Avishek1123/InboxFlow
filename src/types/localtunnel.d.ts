declare module "localtunnel" {
  type LocalTunnelOptions = {
    port: number;
    subdomain?: string;
    host?: string;
    local_https?: boolean;
    local_host?: string;
    allow_invalid_cert?: boolean;
  };

  type Tunnel = {
    url?: string;
    close(): void;
    on(event: "close", listener: () => void): void;
    on(event: "error", listener: (err: Error) => void): void;
  };

  export default function localtunnel(
    options: LocalTunnelOptions
  ): Promise<Tunnel>;
}
