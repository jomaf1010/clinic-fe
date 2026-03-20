import type { InjectionKey } from "vue"

export type TabsSize = "sm" | "default" | "lg"

export const TabsSizeKey: InjectionKey<TabsSize> = Symbol("TabsSize")
