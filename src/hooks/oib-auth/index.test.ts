import { describe, it, expect } from "bun:test"
import { createOibAuthHook } from "./index"

describe("oib-auth hook", () => {
  it("should return correct provider ID", () => {
    //#given
    const hook = createOibAuthHook()

    //#when
    const provider = hook.provider

    //#then
    expect(provider).toBe("oh-im-broke")
  })

  it("should have one auth method", () => {
    //#given
    const hook = createOibAuthHook()

    //#when
    const methods = hook.methods

    //#then
    expect(methods).toHaveLength(1)
  })

  it("should have auth method type as 'api'", () => {
    //#given
    const hook = createOibAuthHook()

    //#when
    const method = hook.methods[0]

    //#then
    expect(method.type).toBe("api")
  })

  it("should have correct auth method label", () => {
    //#given
    const hook = createOibAuthHook()

    //#when
    const method = hook.methods[0]

    //#then
    expect(method.label).toBe("Oh Im Broke Budget Router")
  })

  it("should have authorize function", () => {
    //#given
    const hook = createOibAuthHook()

    //#when
    const method = hook.methods[0]

    //#then
    expect(typeof method.authorize).toBe("function")
  })

  it("authorize() should return success type", async () => {
    //#given
    const hook = createOibAuthHook()
    const method = hook.methods[0]

    //#when
    const result = await method.authorize?.()

    //#then
    expect(result).toBeDefined()
    if (result && "type" in result) {
      expect(result.type).toBe("success")
    }
  })

  it("authorize() should return correct key", async () => {
    //#given
    const hook = createOibAuthHook()
    const method = hook.methods[0]

    //#when
    const result = await method.authorize?.()

    //#then
    expect(result).toBeDefined()
    if (result && "key" in result) {
      expect(result.key).toBe("virtual-no-auth")
    }
  })

  it("authorize() should return correct provider", async () => {
    //#given
    const hook = createOibAuthHook()
    const method = hook.methods[0]

    //#when
    const result = await method.authorize?.()

    //#then
    expect(result).toBeDefined()
    if (result && "provider" in result) {
      expect(result.provider).toBe("oh-im-broke")
    }
  })

  it("should have loader function", () => {
    //#given
    const hook = createOibAuthHook()

    //#when
    const loader = hook.loader

    //#then
    expect(typeof loader).toBe("function")
  })

  it("loader should return models array", async () => {
    //#given
    const hook = createOibAuthHook()

    //#when
    const result = await hook.loader?.(() => Promise.resolve({} as any), {} as any)

    //#then
    expect(result).toBeDefined()
    expect(result).toHaveProperty("models")
    expect(Array.isArray(result?.models)).toBe(true)
  })

  it("loader should return correct model structure", async () => {
    //#given
    const hook = createOibAuthHook()

    //#when
    const result = await hook.loader?.(() => Promise.resolve({} as any), {} as any)

    //#then
    expect(result?.models).toHaveLength(1)
    const model = result?.models[0]
    expect(model).toHaveProperty("id", "oib-autoselect")
    expect(model).toHaveProperty("name", "OIB Autoselect")
    expect(model).toHaveProperty("provider", "oh-im-broke")
  })
})