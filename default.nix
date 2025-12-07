{ lib
, stdenv
, glib
, gom
, gsound
,
}:

# This package assumes you've already built with `yarn build`
# and the dist/ directory exists with the compiled extension.
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
    # Patch the hardcoded Nix store path for gom to use the actual package path
    substituteInPlace extension.js \
      --replace-fail "/nix/store/32mj4p8wzn03cx7zvaydz298zk0sc64p-gom-0.5.3/lib/girepository-1.0" "${gom}/lib/girepository-1.0"

    # Add gsound path if the extension uses it
    if grep -q "gi://GSound" extension.js; then
      substituteInPlace extension.js \
        --replace-fail "import GSound from 'gi://GSound'" \
        "imports.gi.GIRepository.Repository.prepend_search_path('${gsound}/lib/girepository-1.0'); const GSound = (await import('gi://GSound')).default"
    fi
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/gnome-shell/extensions/pano@elhan.io
    cp -r . $out/share/gnome-shell/extensions/pano@elhan.io
    runHook postInstall
  '';

  passthru = {
    extensionPortalSlug = "pano";
    extensionUuid = "pano@elhan.io";
  };

  meta = with lib; {
    description = "Next-gen Clipboard Manager for GNOME Shell (with libgom)";
    homepage = "https://github.com/tennox/gnome-shell-pano";
    license = licenses.gpl2Plus;
    platforms = platforms.linux;
  };
})
