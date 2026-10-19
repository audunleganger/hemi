package com.hemi.shared

object AppInfo {
    /** The version of this source tree. A release image reports its tag instead (`HEMI_VERSION`). */
    const val VERSION = "0.1.0"

    /** Major API version. Clients refuse to talk to a server with a different one. */
    const val API_VERSION = 1
}
