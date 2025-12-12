// Gom typelib should be available via system GIRepository paths or GI_TYPELIB_PATH
// For NixOS: Nix build injects prepend_search_path at build time
// For development: devenv.nix sets GI_TYPELIB_PATH environment variable

const GObject = (imports.gi as any).GObject as any;
const GLib = (imports.gi as any).GLib as any;
const Gom = (imports.gi as any).Gom;
import { logger } from '@pano/utils/shell';

const debug = logger('database');

export type ItemType = 'IMAGE' | 'LINK' | 'TEXT' | 'CODE' | 'COLOR' | 'EMOJI' | 'FILE';

export type DBItem = {
  id: number;
  itemType: ItemType;
  content: string;
  copyDate: Date;
  isFavorite: boolean;
  matchValue: string;
  searchValue?: string | undefined;
  metaData?: string | undefined;
};

export type SaveDBItem = Omit<DBItem, 'id'>;

// Define ClipboardResource class extending Gom.Resource
const ClipboardResource = GObject.registerClass(
  {
    GTypeName: 'PanoClipboardResource',
    Extends: Gom.Resource,
    Properties: {
      id: GObject.ParamSpec.int(
        'id',
        'ID',
        'Resource ID',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
        0,
        2147483647,
        0,
      ),
      'item-type': GObject.ParamSpec.string(
        'item-type',
        'Item Type',
        'Type of clipboard item',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
        'TEXT',
      ),
      content: GObject.ParamSpec.string(
        'content',
        'Content',
        'Clipboard content',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
        '',
      ),
      'copy-date': GObject.ParamSpec.string(
        'copy-date',
        'Copy Date',
        'When item was copied',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
        '',
      ),
      'is-favorite': GObject.ParamSpec.boolean(
        'is-favorite',
        'Is Favorite',
        'Whether item is marked as favorite',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
        false,
      ),
      'match-value': GObject.ParamSpec.string(
        'match-value',
        'Match Value',
        'Value for matching duplicates',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
        '',
      ),
      'search-value': GObject.ParamSpec.string(
        'search-value',
        'Search Value',
        'Value for searching',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
        '',
      ),
      'meta-data': GObject.ParamSpec.string(
        'meta-data',
        'Meta Data',
        'Additional metadata',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
        '',
      ),
    },
  },
  class ClipboardResource extends Gom.Resource {
    declare _id: number | undefined;
    declare _item_type: ItemType | undefined;
    declare _content: string | undefined;
    declare _copy_date: string | undefined;
    declare _is_favorite: boolean | undefined;
    declare _match_value: string | undefined;
    declare _search_value: string | undefined;
    declare _meta_data: string | undefined;

    // Property accessors
    get id() {
      return this._id || 0;
    }
    set id(value) {
      this._id = value;
    }

    get item_type() {
      return this._item_type || 'TEXT';
    }
    set item_type(value) {
      this._item_type = value;
    }

    get content() {
      return this._content || '';
    }
    set content(value) {
      this._content = value;
    }

    get copy_date() {
      return this._copy_date || '';
    }
    set copy_date(value) {
      this._copy_date = value;
    }

    get is_favorite() {
      return this._is_favorite || false;
    }
    set is_favorite(value) {
      this._is_favorite = value;
    }

    get match_value() {
      return this._match_value || '';
    }
    set match_value(value) {
      this._match_value = value;
    }

    get search_value() {
      return this._search_value || '';
    }
    set search_value(value) {
      this._search_value = value;
    }

    get meta_data() {
      return this._meta_data || '';
    }
    set meta_data(value) {
      this._meta_data = value;
    }
  },
);

Gom.Resource.set_table.call(ClipboardResource, 'clipboard');
Gom.Resource.set_primary_key.call(ClipboardResource, 'id');

/**
 * Simple unescape function for strings stored in database
 */
function unescape_string(input: string): string {
  if (!input || !input.includes('\\')) {
    return input;
  }

  try {
    return input.replaceAll(/\\(.)/g, (_all, captured) => {
      if (captured === '\\' || captured === "'") {
        return captured;
      }
      throw new Error(`Unexpected escape character '${captured}'`);
    });
  } catch (error) {
    debug(`Error in unescape: ${error}`);
    return input;
  }
}

// Query classes for compatibility
interface QueryCondition {
  field: string;
  op: 'eq' | 'like' | 'in';
  value: any;
}

class ClipboardQuery {
  readonly conditions: QueryCondition[];
  readonly limitValue: number | undefined;
  readonly offsetValue: number | undefined;

  constructor(conditions: QueryCondition[], limitValue?: number, offsetValue?: number) {
    this.conditions = conditions;
    this.limitValue = limitValue;
    this.offsetValue = offsetValue;
  }
}

export class ClipboardQueryBuilder {
  private conditions: QueryCondition[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  withLimit(limit: number, offset: number) {
    this.limitValue = limit;
    this.offsetValue = offset;
    return this;
  }

  withId(id?: number | null) {
    if (id !== null && id !== undefined) {
      this.conditions.push({ field: 'id', op: 'eq', value: id });
    }
    return this;
  }

  withItemTypes(itemTypes?: ItemType[] | null) {
    if (itemTypes !== null && itemTypes !== undefined) {
      this.conditions.push({ field: 'item-type', op: 'in', value: itemTypes });
    }
    return this;
  }

  withContent(content?: string | null) {
    if (content !== null && content !== undefined) {
      this.conditions.push({ field: 'content', op: 'eq', value: content });
    }
    return this;
  }

  withMatchValue(matchValue?: string | null) {
    if (matchValue !== null && matchValue !== undefined) {
      this.conditions.push({ field: 'match-value', op: 'eq', value: matchValue });
    }
    return this;
  }

  withContainingContent(content?: string | null) {
    if (content !== null && content !== undefined) {
      this.conditions.push({ field: 'content', op: 'like', value: `%${content}%` });
    }
    return this;
  }

  withContainingSearchValue(searchValue?: string | null) {
    if (searchValue !== null && searchValue !== undefined) {
      this.conditions.push({ field: 'search-value', op: 'like', value: `%${searchValue}%` });
    }
    return this;
  }

  withFavorites(include: boolean) {
    if (include !== null && include !== undefined) {
      this.conditions.push({ field: 'is-favorite', op: 'eq', value: include });
    }
    return this;
  }

  build(): ClipboardQuery {
    return new ClipboardQuery(this.conditions, this.limitValue, this.offsetValue);
  }
}

class Database {
  private repository: any = null;
  private adapter: any = null;
  private dbPath: string | null = null;
  private attemptedReset = false;

  setup(dbPath: string) {
    try {
      this.dbPath = dbPath;
      this.adapter = (Gom.Adapter as any).new();
      this.adapter.open_sync(`${dbPath}/pano.db`);

      this.repository = (Gom.Repository as any).new(this.adapter);

      // Use automatic migration to create/update the database schema
      const object_types = [ClipboardResource];
      const migrated = this.repository.automatic_migrate_sync(1, object_types);
      if (!migrated) {
        debug('Failed to migrate database schema');
        throw new Error('Database migration failed');
      }

      debug('Database setup completed');
    } catch (error) {
      debug(`Database setup error: ${error}`);
      throw error;
    }
  }

  private resetDatabase() {
    if (!this.dbPath) {
      return;
    }

    try {
      this.shutdown();
    } catch (shutdownError) {
      debug(`Database reset shutdown error: ${shutdownError}`);
    }

    try {
      const dbFile = GLib.build_filenamev([this.dbPath, 'pano.db']);
      if (GLib.file_test(dbFile, GLib.FileTest.EXISTS)) {
        GLib.unlink(dbFile);
      }
    } catch (resetError) {
      debug(`Database reset unlink error: ${resetError}`);
    }

    this.setup(this.dbPath);
  }

  private tryResetOnSchemaError(error: unknown): boolean {
    if (!this.dbPath || this.attemptedReset) {
      return false;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('no such column') && !message.includes('has no column named')) {
      return false;
    }

    debug('Resetting database due to schema mismatch');
    this.attemptedReset = true;
    this.resetDatabase();
    return true;
  }

  save(dbItem: SaveDBItem): DBItem | null {
    if (!this.repository) {
      debug('Repository not initialized');
      return null;
    }

    try {
      const resource = new ClipboardResource({
        repository: this.repository,
        item_type: dbItem.itemType,
        content: dbItem.content,
        copy_date: dbItem.copyDate.toISOString(),
        is_favorite: dbItem.isFavorite,
        match_value: dbItem.matchValue,
        search_value: dbItem.searchValue || '',
        meta_data: dbItem.metaData || '',
      });

      const success = resource.save_sync();
      if (!success) {
        debug('Failed to save resource');
        return null;
      }

      return {
        id: resource.id,
        itemType: dbItem.itemType,
        content: dbItem.content,
        copyDate: dbItem.copyDate,
        isFavorite: dbItem.isFavorite,
        matchValue: dbItem.matchValue,
        searchValue: dbItem.searchValue,
        metaData: dbItem.metaData,
      };
    } catch (error) {
      debug(`Save error: ${error}`);
      if (this.tryResetOnSchemaError(error)) {
        return this.save(dbItem);
      }
    }
    return null;
  }

  update(dbItem: DBItem): DBItem | null {
    if (!this.repository) {
      debug('Repository not initialized');
      return null;
    }

    try {
      // First find the existing resource
      const filter = Gom.Filter.new_eq(ClipboardResource, 'id', dbItem.id);
      const resource = this.repository.find_one_sync(ClipboardResource, filter);

      if (!resource) {
        debug(`Resource with id ${dbItem.id} not found`);
        return null;
      }

      // Update the properties
      resource.item_type = dbItem.itemType;
      resource.content = dbItem.content;
      resource.copy_date = dbItem.copyDate.toISOString();
      resource.is_favorite = dbItem.isFavorite;
      resource.match_value = dbItem.matchValue;
      resource.search_value = dbItem.searchValue || '';
      resource.meta_data = dbItem.metaData || '';

      const success = resource.save_sync();
      if (!success) {
        debug('Failed to update resource');
        return null;
      }

      return dbItem;
    } catch (error) {
      debug(`Update error: ${error}`);
      if (this.tryResetOnSchemaError(error)) {
        return this.update(dbItem);
      }
    }
    return null;
  }

  delete(id: number): void {
    if (!this.repository) {
      debug('Repository not initialized');
      return;
    }

    try {
      const filter = Gom.Filter.new_eq(ClipboardResource, 'id', id);
      const resource = this.repository.find_one_sync(ClipboardResource, filter);

      if (resource) {
        const success = resource.delete_sync();
        if (!success) {
          debug(`Failed to delete resource with id ${id}`);
        }
      }
    } catch (error) {
      debug(`Delete error: ${error}`);
      if (this.tryResetOnSchemaError(error)) {
        this.delete(id);
      }
    }
  }

  query(clipboardQuery: ClipboardQuery): DBItem[] {
    if (!this.repository) {
      debug('Repository not initialized');
      return [];
    }

    try {
      const group = this.repository.find_sync(ClipboardResource, null);
      if (!group) {
        return [];
      }

      const count = group.get_count();

      if (count > 0) {
        group.fetch_sync(0, count);
      }

      const fieldMap: Record<string, keyof DBItem> = {
        'item-type': 'itemType',
        'copy-date': 'copyDate',
        'is-favorite': 'isFavorite',
        'match-value': 'matchValue',
        'search-value': 'searchValue',
        'meta-data': 'metaData',
      };

      const items: DBItem[] = [];
      for (let i = 0; i < count; i++) {
        const resource = group.get_index(i);
        if (resource) {
          items.push({
            id: resource.id,
            itemType: resource.item_type as ItemType,
            content: unescape_string(resource.content),
            copyDate: new Date(resource.copy_date),
            isFavorite: resource.is_favorite,
            matchValue: unescape_string(resource.match_value),
            searchValue: resource.search_value ? unescape_string(resource.search_value) : undefined,
            metaData: resource.meta_data,
          });
        }
      }

      const filtered = items.filter((item) => {
        return clipboardQuery.conditions.every((condition) => {
          const dbField = fieldMap[condition.field] ?? (condition.field as keyof DBItem);
          const value = item[dbField];

          if (condition.op === 'eq') {
            if (value instanceof Date) {
              return value.toISOString() === String(condition.value);
            }
            return value === condition.value;
          }

          if (condition.op === 'like') {
            if (typeof value !== 'string') {
              return false;
            }
            const needle = String(condition.value).replace(/%/g, '').toLowerCase();
            return value.toLowerCase().includes(needle);
          }

          if (condition.op === 'in') {
            const values: any[] = Array.isArray(condition.value) ? condition.value : [];
            return values.includes(value);
          }

          return true;
        });
      });

      const jsStart = clipboardQuery.offsetValue || 0;
      const limit = clipboardQuery.limitValue ?? -1;
      const jsEnd = limit > -1 ? Math.min(jsStart + limit, filtered.length) : filtered.length;

      return filtered.slice(jsStart, jsEnd);
    } catch (error) {
      debug(`Query error: ${error}`);
      if (this.tryResetOnSchemaError(error)) {
        return this.query(clipboardQuery);
      }
      return [];
    }
  }

  start(dbPath: string) {
    if (!this.repository && dbPath) {
      this.setup(dbPath);
    }
  }

  shutdown() {
    if (this.adapter) {
      try {
        this.adapter.close_sync();
      } catch (error) {
        debug(`Shutdown error: ${error}`);
      }
      this.adapter = null;
      this.repository = null;
    }
  }
}

export const db = new Database();
