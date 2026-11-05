import os
import urllib.request
import zipfile

os.makedirs("android_tools", exist_ok=True)

# 1. Download AAPT2 from Maven
aapt2_jar = "android_tools/aapt2.jar"
if not os.path.exists("android_tools/aapt2.exe"):
    print("Downloading AAPT2...")
    aapt2_url = "https://dl.google.com/dl/android/maven2/com/android/tools/build/aapt2/8.2.2-10154469/aapt2-8.2.2-10154469-windows.jar"
    urllib.request.urlretrieve(aapt2_url, aapt2_jar)
    with zipfile.ZipFile(aapt2_jar, 'r') as z:
        z.extract("aapt2.exe", "android_tools")
    os.remove(aapt2_jar)
    print("AAPT2 extracted successfully.")
else:
    print("AAPT2 already exists.")

# 2. Download R8 (D8 dexer) from Maven
r8_jar = "android_tools/r8.jar"
if not os.path.exists(r8_jar):
    print("Downloading R8 / D8...")
    r8_url = "https://dl.google.com/dl/android/maven2/com/android/tools/r8/8.2.42/r8-8.2.42.jar"
    urllib.request.urlretrieve(r8_url, r8_jar)
    print("R8 downloaded successfully.")
else:
    print("R8 already exists.")

# 3. Download android.jar from Google repository
android_jar = "android_tools/android.jar"
if not os.path.exists(android_jar):
    print("Downloading Android Platform 33...")
    zip_path = "android_tools/platform-33.zip"
    platform_url = "https://dl.google.com/android/repository/platform-33_r01.zip"
    
    # Progress reporter
    def reporthook(count, block_size, total_size):
        if count % 200 == 0:
            percent = int(count * block_size * 100 / total_size)
            print(f"  Downloading: {percent}%", end="\r")

    urllib.request.urlretrieve(platform_url, zip_path, reporthook)
    print("\nExtracting android.jar...")
    with zipfile.ZipFile(zip_path, 'r') as z:
        for member in z.namelist():
            if member.endswith("android.jar"):
                with z.open(member) as source, open(android_jar, "wb") as target:
                    target.write(source.read())
                break
    os.remove(zip_path)
    print("android.jar extracted successfully.")
else:
    print("android.jar already exists.")

print("All Android tools ready!")
