import os
import shutil
import subprocess
import zipfile

def run(cmd, desc):
    print(f"\n[+] {desc}...")
    print("    CMD:", cmd)
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[-] ERROR in {desc} (code {res.returncode}):")
        print("STDOUT:", res.stdout)
        print("STDERR:", res.stderr)
        raise RuntimeError(f"Step failed: {desc}")
    if res.stdout:
        print("    " + res.stdout.strip().replace("\n", "\n    "))
    return res

def main():
    root = os.path.abspath(".")
    tools_dir = os.path.join(root, "android_tools")
    proj_dir = os.path.join(root, "android_project")
    aapt2 = os.path.join(tools_dir, "aapt2.exe")
    android_jar = os.path.join(tools_dir, "android.jar")
    r8_jar = os.path.join(tools_dir, "r8.jar")
    zipalign = os.path.join(tools_dir, "zipalign.exe")
    apksigner_jar = os.path.join(tools_dir, "apksigner.jar")

    assets_dest = os.path.join(proj_dir, "assets")
    os.makedirs(assets_dest, exist_ok=True)

    # 1. Copy web assets to android_project/assets
    print("[1] Syncing web assets to APK assets folder...")
    for f in ["index.html", "catalog.html", "manifest.json", "sw.js"]:
        shutil.copy2(os.path.join(root, f), os.path.join(assets_dest, f))

    for folder in ["css", "js"]:
        dest_folder = os.path.join(assets_dest, folder)
        if os.path.exists(dest_folder):
            shutil.rmtree(dest_folder)
        shutil.copytree(os.path.join(root, folder), dest_folder)

    # Clean intermediate directories
    gen_dir = os.path.join(proj_dir, "gen")
    classes_dir = os.path.join(proj_dir, "classes")
    dex_out = os.path.join(proj_dir, "dex_out")
    os.makedirs(gen_dir, exist_ok=True)
    os.makedirs(classes_dir, exist_ok=True)
    os.makedirs(dex_out, exist_ok=True)

    compiled_res = os.path.join(proj_dir, "compiled_res.zip")
    base_apk = os.path.join(proj_dir, "base_app.apk")
    if os.path.exists(compiled_res): os.remove(compiled_res)
    if os.path.exists(base_apk): os.remove(base_apk)

    # 2. AAPT2 Compile
    res_dir = os.path.join(proj_dir, "res")
    run(f'"{aapt2}" compile --dir "{res_dir}" -o "{compiled_res}"', "Compiling Android resources with aapt2")

    # 3. AAPT2 Link
    manifest = os.path.join(proj_dir, "AndroidManifest.xml")
    run(f'"{aapt2}" link -I "{android_jar}" "{compiled_res}" --manifest "{manifest}" -o "{base_apk}" --java "{gen_dir}"', "Linking APK & generating R.java")

    # 4. Javac compilation
    r_java = os.path.join(gen_dir, "com", "sweetsmile", "pastry", "R.java")
    main_java = os.path.join(proj_dir, "src", "com", "sweetsmile", "pastry", "MainActivity.java")
    run(f'javac -cp "{android_jar}" "{r_java}" "{main_java}" -d "{classes_dir}"', "Compiling Java classes with javac")

    # 5. D8 Dexing
    class_files = [os.path.join(classes_dir, "com", "sweetsmile", "pastry", f) for f in os.listdir(os.path.join(classes_dir, "com", "sweetsmile", "pastry")) if f.endswith(".class")]
    class_args = " ".join([f'"{f}"' for f in class_files])
    run(f'java -cp "{r8_jar}" com.android.tools.r8.D8 --lib "{android_jar}" --output "{dex_out}" {class_args}', "Dexing classes into classes.dex with D8")

    # 6. Packaging classes.dex and web assets into unaligned APK
    print("\n[6] Packaging classes.dex and web assets into unaligned APK...")
    classes_dex = os.path.join(dex_out, "classes.dex")
    unaligned_apk = os.path.join(proj_dir, "unaligned.apk")
    shutil.copy2(base_apk, unaligned_apk)

    with zipfile.ZipFile(unaligned_apk, "a", compression=zipfile.ZIP_DEFLATED) as apk_zip:
        # Add classes.dex
        apk_zip.write(classes_dex, "classes.dex")

        # Add assets
        for root_dir, dirs, files in os.walk(assets_dest):
            for file in files:
                abs_file = os.path.join(root_dir, file)
                rel_path = os.path.relpath(abs_file, proj_dir)
                apk_zip.write(abs_file, rel_path)
    print("    Classes & assets packaged successfully.")

    # 7. ZipAlign (4-byte alignment required by Android)
    aligned_apk = os.path.join(proj_dir, "aligned.apk")
    if os.path.exists(aligned_apk): os.remove(aligned_apk)
    run(f'"{zipalign}" -p -f 4 "{unaligned_apk}" "{aligned_apk}"', "Aligning APK with zipalign")

    # 8. Ensure Debug Keystore exists
    keystore = os.path.join(proj_dir, "debug.keystore")
    if not os.path.exists(keystore):
        run(f'keytool -genkeypair -v -keystore "{keystore}" -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=SweetSmile,OU=Pastry,O=SweetSmile,L=SantoDomingo,S=SD,C=DO"', "Generating Debug Keystore")

    # 9. Sign APK with official apksigner (enables v1, v2, v3 signature schemes)
    final_apk = os.path.join(root, "SweetSmilePastry_v1.0.apk")
    if os.path.exists(final_apk): os.remove(final_apk)
    run(f'java -jar "{apksigner_jar}" sign --ks "{keystore}" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out "{final_apk}" "{aligned_apk}"', "Signing with apksigner (v1, v2, v3 schemes)")

    # 10. Verify signature with apksigner
    run(f'java -jar "{apksigner_jar}" verify --verbose "{final_apk}"', "Verifying signature schemes with apksigner")

    size_mb = os.path.getsize(final_apk) / (1024 * 1024)
    print("\n" + "="*55)
    print(f"🎉 SUCCESS! APK built and signed with Signature Scheme v2/v3!")
    print(f"File: {final_apk}")
    print(f"Size: {size_mb:.2f} MB")
    print("="*55)

if __name__ == "__main__":
    main()
