{ lib
, stdenv
, glib
, gom
, gsound
,
}:

# This package fetches pre-built release artifacts from GitHub.
# Releases are created by GitHub Actions when tags are pushed.
#
# Usage in your NixOS config:
#   environment.systemPackages = [
#     (pkgs.callPackage /path/to/gnome-shell-pano {})
#   ];
#
# Or add to gnome shell extensions:
#   programs.gnome-shell.extensions = [
#     (pkgs.callPackage /path/to/gnome-shell-pano {})
#   ];

stdenv.mkDerivation (finalAttrs: {
  pname = "gnome-shell-extension-pano";
  version = "24-gom";

  # TODO: Switch to GitHub release once flake can be used in CI
  # For now, dist/ must be committed to git (or built locally with `yarn build`)
  # src = fetchzip {
  #   url = "https://github.com/tennox/gnome-shell-pano/releases/download/v24-gom/pano-gom@txlab.io.zip";
  #   hash = "sha256-...";
  # };

  src = ./dist;

  nativeBuildInputs = [
    glib
  ];

  buildPhase = ''
    runHook preBuild
    glib-compile-schemas --strict schemas
    runHook postBuild
  '';

  preInstall = ''
    # Inject Gom typelib path at the beginning of extension.js
    # Source code no longer has hardcoded path - we inject it during build for NixOS
    sed -i "1i imports.gi.GIRepository.Repository.prepend_search_path('${gom}/lib/girepository-1.0');" extension.js

    # Add gsound path if the extension uses it
    if grep -q "gi://GSound" extension.js; then
      substituteInPlace extension.js \
        --replace-fail "import GSound from 'gi://GSound'" \
        "imports.gi.GIRepository.Repository.prepend_search_path('${gsound}/lib/girepository-1.0'); const GSound = (await import('gi://GSound')).default"
    fi
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/gnome-shell/extensions/pano-gom@txlab.io
    cp -r . $out/share/gnome-shell/extensions/pano-gom@txlab.io
    runHook postInstall
  '';

  passthru = {
    extensionPortalSlug = "pano";
    extensionUuid = "pano-gom@txlab.io";
  };

  meta = with lib; {
    description = "Next-gen Clipboard Manager for GNOME Shell (with libgom)";
    homepage = "https://github.com/tennox/gnome-shell-pano";
    license = licenses.gpl2Plus;
    platforms = platforms.linux;
  };
})
