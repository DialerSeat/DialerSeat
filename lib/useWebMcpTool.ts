'use client'

import { useEffect, useRef } from 'react'

// =============================================================================
// WEBMCP — hand a page's calculator to an AI agent as a callable tool
// =============================================================================
// WebMCP (webmachinelearning.github.io/webmcp, W3C Draft Community Group
// Report) lets a page register tools that an agent in the browser calls
// directly, instead of reading the DOM and typing into inputs. Chrome ships it
// behind an origin trial as document.modelContext (navigator.modelContext was
// the earlier draft and is deprecated); a browser without it has no
// document.modelContext, so this does nothing there.
//
// Each tool computes with the same function the visible calculator uses, so an
// agent and a person get the same figure. Registration is undone on unmount
// through the AbortSignal the spec provides. Whatever execute returns, the
// browser serialises to JSON for the agent.
// =============================================================================

export type WebMcpTool = {
  name: string
  title?: string
  description: string
  inputSchema?: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean; untrustedContentHint?: boolean }
  execute: (input: Record<string, unknown>) => unknown
}

type ModelContext = {
  registerTool?: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void>
}

export function useWebMcpTool(tool: WebMcpTool) {
  // The latest execute, so the registration does not churn on every render.
  const latest = useRef(tool)
  useEffect(() => { latest.current = tool })

  useEffect(() => {
    const mc = (document as Document & { modelContext?: ModelContext }).modelContext
    if (typeof mc?.registerTool !== 'function') return
    const controller = new AbortController()
    const { name, title, description, inputSchema, annotations } = latest.current
    mc.registerTool(
      { name, title, description, inputSchema, annotations, execute: async (input) => latest.current.execute(input ?? {}) },
      { signal: controller.signal },
    ).catch(() => {
      // Not allowed here (a cross-origin embed without the "tools"
      // permission) or the name is taken: the calculator still works.
    })
    return () => controller.abort()
  }, [tool.name])
}
