// Type declarations for GIRepository and Gom dynamic imports

declare namespace imports {
  namespace gi {
    namespace GIRepository {
      class Repository {
        static prepend_search_path(path: string): void;
      }
    }
  }
}

// Augment the Gom types to support dynamic import
declare module 'gi://Gom' {
  import type Gom from '@girs/gom-1.0';
  export default typeof Gom;
}
