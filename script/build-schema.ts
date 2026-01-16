#!/usr/bin/env bun
import * as z from "zod"
import { OhMyAutoCodeConfigSchema } from "../src/config/schema"

const SCHEMA_OUTPUT_PATH = "assets/oh_my_autocode.schema.json"

async function main() {
  console.log("Generating JSON Schema...")

  const jsonSchema = z.toJSONSchema(OhMyAutoCodeConfigSchema, {
    io: "input",
    target: "draft-7",
  })

  const finalSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://raw.githubusercontent.com/sadnow/oh_my_autocode/master/assets/oh_my_autocode.schema.json",
    title: "Oh My AutoCode Configuration",
    description: "Configuration schema for oh_my_autocode plugin",
    ...jsonSchema,
  }

  await Bun.write(SCHEMA_OUTPUT_PATH, JSON.stringify(finalSchema, null, 2))

  console.log(`✓ JSON Schema generated: ${SCHEMA_OUTPUT_PATH}`)
}

main()
