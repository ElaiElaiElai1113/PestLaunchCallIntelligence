import type { CallRecord } from "../domain/types";

export type StoragePort = {
  list(
    bucket: string,
    prefix: string,
    offset: number,
    limit: number,
  ): Promise<{ name: string; id: string | null }[]>;
  remove(bucket: string, paths: string[]): Promise<void>;
};

export async function deleteCallMedia(port: StoragePort, call: CallRecord) {
  const prefix = call.workspaceId + "/";
  for (const [bucket, registered] of [
    ["call-source", call.sourcePath],
    ["call-sanitized", call.sanitizedPath],
  ] as const) {
    if (registered && !registered.startsWith(prefix))
      throw new Error("DELETE_STORAGE_FAILED");
    const inventory = async () => {
      const paths: string[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await port.list(bucket, call.workspaceId, offset, 100);
        for (const item of page) {
          if (item.name === call.id || item.name.startsWith(call.id + ".")) {
            if (!item.id) throw new Error("DELETE_STORAGE_FAILED");
            paths.push(prefix + item.name);
          }
        }
        if (page.length < 100) return paths;
      }
    };
    const paths = [
      ...new Set([...(registered ? [registered] : []), ...(await inventory())]),
    ];
    for (let offset = 0; offset < paths.length; offset += 100)
      await port.remove(bucket, paths.slice(offset, offset + 100));
    if ((await inventory()).length) throw new Error("DELETE_STORAGE_FAILED");
  }
}
