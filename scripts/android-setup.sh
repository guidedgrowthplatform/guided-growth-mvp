#!/bin/bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"
export ANDROID_SDK_ROOT="/opt/homebrew/share/android-commandlinetools"

SDKMANAGER="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"

echo "Java version:"
java -version

echo ""
echo "Accepting all licenses..."
yes | "$SDKMANAGER" --sdk_root="$ANDROID_SDK_ROOT" --licenses 2>&1 | tail -10

echo ""
echo "Verifying SDK components..."
"$SDKMANAGER" --sdk_root="$ANDROID_SDK_ROOT" --list_installed 2>&1 | head -20
