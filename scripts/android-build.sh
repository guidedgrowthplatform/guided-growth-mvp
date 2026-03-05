#!/bin/bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"
export ANDROID_SDK_ROOT="/opt/homebrew/share/android-commandlinetools"

cd /Users/tv01d/Downloads/growthproject/guided-growth-mvp

echo "=== Building debug APK ==="
cd android
./gradlew assembleDebug 2>&1

echo ""
echo "=== APK location ==="
find . -name "*.apk" -type f 2>&1
