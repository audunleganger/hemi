package com.hemi.shared.rules

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

val OSLO: ZoneId = ZoneId.of("Europe/Oslo")

/** A moment from local Oslo time, e.g. at("2026-10-19T14:00"). */
fun at(local: String, zone: ZoneId = OSLO): Moment = Moment.of(LocalDateTime.parse(local).atZone(zone).toInstant().toEpochMilli(), zone)

fun day(iso: String): LocalDate = LocalDate.parse(iso)
