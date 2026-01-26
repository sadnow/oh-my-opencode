/**
 * Hot Config Module
 * Runtime configuration management with hot-reload support
 */

export {
  HotConfigManager,
  initHotConfigManager,
  getHotConfigManager,
  type HotConfigManagerOptions,
  type ConfigChangeEvent,
} from "./manager"

export {
  ConfigChangeQueue,
  type ConfigChange,
} from "./queue"
