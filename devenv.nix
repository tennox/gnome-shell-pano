# Docs: https://devenv.sh/basics/
{ pkgs, inputs, ... }:
let
  # https://devenv.sh/common-patterns/#getting-a-recent-version-of-a-package-from-nixpkgs-unstable
  pkgs-latest = inputs.nixpkgs-unstable.legacyPackages.${pkgs.system};
in
{

  languages = {
    # Docs: https://devenv.sh/languages/
    nix.enable = true;
    javascript = {
      enable = true; # source: https://github.com/cachix/devenv/blob/main/src/modules/languages/javascript.nix
      package = pkgs-latest.nodejs_22; # Use Node.js 22 from unstable
      # TODO remove whichever you don't need:
      npm.enable = true;
      pnpm = {
        enable = true;
        package = pkgs-latest.nodePackages.pnpm;
      };
      yarn.enable = true;
    };
    typescript.enable = true;
    deno.enable = true;
  };

  packages = with pkgs; [
    gcc # needed for some npm packages
    nodePackages.typescript-language-server # many editors benefit from this
    glib # for glib-compile-schemas command

    # For nested GNOME session testing
    xvfb-run

    # Search for packages: https://search.nixos.org/packages?channel=unstable&query=cowsay 
    # (note: this searches on unstable channel, you might need to use pkgs-latest for some):
    pkgs-latest.go-task
  ];

  scripts = {
    # Docs: https://devenv.sh/scripts/
    install-extension = {
      exec = ''
        yarn build
        ln -sf "$PWD/dist" "$HOME/.local/share/gnome-shell/extensions/pano@elhan.io"
        echo "Extension installed to ~/.local/share/gnome-shell/extensions/pano@elhan.io"
      '';
      description = "Build and install extension for testing";
    };

    test-nested = {
      exec = ''
        # Create a nested GNOME session for testing
        export MUTTER_DEBUG_DUMMY_MODE_SPECS=1200x800
        export MUTTER_DEBUG_DUMMY_MONITOR_SCALES=1
        dbus-run-session -- gnome-shell --nested --wayland
      '';
      description = "Start nested GNOME session for testing extensions";
    };
  };

  pre-commit.hooks = {
    # Docs: https://devenv.sh/pre-commit-hooks/
    # list of pre-configured hooks: https://devenv.sh/reference/options/#pre-commithooks
    eslint = {
      # enable = true; # TODO disabled by default as it fails if no eslint config exists
      files = "\.(js|ts|vue|jsx|tsx)$";
      fail_fast = true; # skip other pre-commit hooks if this one fails
    };
    nixpkgs-fmt.enable = true; # nix formatting
    nil.enable = true; # nix check
  };

  difftastic.enable = true; # enable semantic diffs - https://devenv.sh/integrations/difftastic/
}
