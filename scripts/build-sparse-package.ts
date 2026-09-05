import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const sparseDir = resolve(root, "app-avalonia", "KuumoApp", "SparsePackage");
const buildDir = resolve(root, "build");
const certDir = resolve(buildDir, "sparse-cert");
const certPfx = resolve(certDir, "PackageTestCertificate.pfx");
const certCer = resolve(certDir, "PackageTestCertificate.cer");
const msixOutput = resolve(buildDir, "kuumo-identity.msix");
const password = "KuumoDev1!";

const KITS_ROOT = "C:\\Program Files (x86)\\Windows Kits\\10";
const SDK_VERSION = "10.0.22621.0";

function run(cmd: string, desc: string) {
    console.log(`  ${desc}...`);
    execSync(cmd, { stdio: "inherit", cwd: root });
}

function findTool(name: string): string {
    for (const arch of ["x64", "x86", "arm64"]) {
        const p = resolve(KITS_ROOT, "bin", SDK_VERSION, arch, name);
        if (existsSync(p)) return p;
    }
    throw new Error(`${name} not found in ${KITS_ROOT}\\bin\\${SDK_VERSION}`);
}

// Step 1: Generate self-signed certificate
if (!existsSync(certDir)) {
    mkdirSync(certDir, { recursive: true });
}

if (!existsSync(certPfx)) {
    console.log("[build-sparse-package] generating self-signed certificate...");
    const psCmd = [
        `$cert = New-SelfSignedCertificate -Type CodeSigningCert`,
        `-Subject 'CN=KuumoApp'`,
        `-CertStoreLocation 'Cert:\\CurrentUser\\My'`,
        `-NotAfter (Get-Date).AddYears(5)`,
        `-HashAlgorithm SHA256`,
        `-KeyUsage DigitalSignature`,
        `-FriendlyName 'KuumoAppSparsePackage'`,
        `;`,
        `$pwd = ConvertTo-SecureString -String '${password}' -Force -AsPlainText`,
        `;`,
        `Export-PfxCertificate -Cert $cert -FilePath '${certPfx}' -Password $pwd`,
        `;`,
        `Export-Certificate -Cert $cert -FilePath '${certCer}'`,
    ].join(" ");
    run(`powershell -NoProfile -Command "${psCmd}"`, "generating certificate");
    console.log(`  cert: ${certPfx}`);
} else {
    console.log("[build-sparse-package] certificate already exists, skipping generation");
}

// Step 2: Import cert into Trusted People store (if not already there)
console.log("[build-sparse-package] ensuring cert is in TrustedPeople store...");
const trustCmd = [
    `$cer = Get-PfxCertificate -FilePath '${certCer}' -ErrorAction SilentlyContinue`,
    `; if ($cer) {`,
    `  $store = Get-ChildItem Cert:\\CurrentUser\\TrustedPeople | Where-Object { $_.Subject -eq 'CN=KuumoApp' }`,
    `; if (-not $store) {`,
    `    Import-Certificate -FilePath '${certCer}' -CertStoreLocation Cert:\\CurrentUser\\TrustedPeople`,
    `; Write-Output 'Certificate imported to TrustedPeople'`,
    `  } else {`,
    `    Write-Output 'Certificate already in TrustedPeople'`,
    `  }`,
    `}`,
].join(" ");
run(`powershell -NoProfile -Command "${trustCmd}"`, "trusting certificate");

// Step 2b: Import cert into Root store (needed for chain validation — requires elevation)
console.log("[build-sparse-package] ensuring cert is in Root store...");
const rootCmd = [
    `$rootStore = Get-ChildItem Cert:\\CurrentUser\\Root | Where-Object { $_.Subject -eq 'CN=KuumoApp' }`,
    `; if (-not $rootStore) {`,
    `  try { Import-Certificate -FilePath '${certCer}' -CertStoreLocation Cert:\\CurrentUser\\Root -ErrorAction Stop; Write-Output 'Certificate imported to Root store' }`,
    `  catch { Write-Output "Root store import needs elevation. Run: certutil -addstore Root '${certCer}'" }`,
    `} else { Write-Output 'Certificate already in Root store' }`,
].join(" ");
run(`powershell -NoProfile -Command "${rootCmd}"`, "trusting root certificate");

// Step 3: Pack MSIX with MakeAppx
const makeappx = findTool("makeappx.exe");
if (existsSync(msixOutput)) {
    rmSync(msixOutput, { force: true });
}
console.log("[build-sparse-package] packing MSIX...");
run(`"${makeappx}" pack /o /d "${sparseDir}" /nv /p "${msixOutput}"`, "MakeAppx pack");

// Step 4: Sign MSIX with SignTool
const signtool = findTool("signtool.exe");
console.log("[build-sparse-package] signing MSIX...");
run(
    `"${signtool}" sign /fd SHA256 /a /f "${certPfx}" /p "${password}" "${msixOutput}"`,
    "SignTool sign",
);

console.log(`\n[build-sparse-package] done: ${msixOutput}`);
