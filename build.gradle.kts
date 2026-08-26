// Kotlin lint entrypoint for packages/core Android sources: ktlintCheck (CI/check) and
// ktlintFormat (local format + optional hooks). Not an Android app build — compile tasks are disabled.

plugins {
  kotlin("jvm") version "2.1.10"
  id("org.jlleitschuh.gradle.ktlint") version "14.2.0"
}

repositories {
  mavenCentral()
}

kotlin {
  jvmToolchain(17)
  sourceSets {
    main {
      kotlin {
        setSrcDirs(
          listOf(
            "packages/core/android/src/main/java",
            "packages/core/android/src/oldarch",
            "packages/core/android/src/test/java",
          ),
        )
      }
    }
    test {
      kotlin.setSrcDirs(emptyList<String>())
    }
  }
}

ktlint {
  version.set("1.5.0")
  android.set(true)
  outputToConsole.set(true)
  filter {
    exclude("**/build/**")
  }
}

tasks.matching { it.name.startsWith("compile") }.configureEach { enabled = false }
tasks.withType<Jar>().configureEach { enabled = false }
tasks.withType<ProcessResources>().configureEach { enabled = false }
tasks.named("testClasses").configure { enabled = false }
