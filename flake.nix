{
  description = "Pano - Next-gen Clipboard Manager for GNOME Shell (with libgom)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixos-unstable";
    devenv.url = "github:cachix/devenv";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
  };

  outputs = { self, nixpkgs, nixpkgs-unstable, devenv, systems, flake-parts, ... } @ inputs: (
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = (import systems);
      imports = [
        inputs.devenv.flakeModule
      ];

      perSystem = { config, self', inputs', pkgs, system, ... }: {
        # Development shell
        devenv.shells.default = {
          imports = [ ./devenv.nix ];
        };

        # Extension package
        packages.default = pkgs.callPackage ./default.nix {
          gom = pkgs.gom;
          gsound = pkgs.gsound;
        };
      };

      flake = {
        # Overlay for easy integration into NixOS configs
        overlays.default = final: prev: {
          gnome-shell-extension-pano-gom = self.packages.${final.system}.default;
        };
      };
    }
  );

  nixConfig = {
    extra-substituters = [ "https://devenv.cachix.org" ];
    extra-trusted-public-keys = [ "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=" ];
  };
}
