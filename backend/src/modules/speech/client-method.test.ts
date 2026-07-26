import { describe, expect, it } from "vitest";
import { bindClientMethod } from "./client-method.js";

describe("bindClientMethod", () => {
  it("giữ đúng client context khi gọi phương thức SDK đã tách ra", async () => {
    const resource = {
      _client: { name: "speech-client" },
      async create(this: { _client: { name: string } }, input: string) {
        return `${this._client.name}:${input}`;
      }
    };

    const create = bindClientMethod(resource, resource.create);

    await expect(create("audio")).resolves.toBe("speech-client:audio");
  });
});
