import Gom from '@girs/gom-1.0';
import GObject from '@girs/gobject-2.0';
import GLib from '@girs/glib-2.0';
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

// Define the GOM Resource class
const ClipboardResource = GObject.registerClass({
  GTypeName: 'PanoClipboardResource',
  Properties: {
    'id': GObject.ParamSpec.int64('id', 'ID', 'Item ID',
      GObject.ParamFlags.READWRITE, 0, GLib.MAXINT64, 0),
    'itemType': GObject.ParamSpec.string('itemType', 'Item Type', 'Type of clipboard item',
      GObject.ParamFlags.READWRITE, ''),
    'content': GObject.ParamSpec.string('content', 'Content', 'Clipboard content',
      GObject.ParamFlags.READWRITE, ''),
    'copyDate': GObject.ParamSpec.string('copyDate', 'Copy Date', 'ISO date string',
      GObject.ParamFlags.READWRITE, ''),
    'isFavorite': GObject.ParamSpec.int('isFavorite', 'Is Favorite', 'Favorite status',
      GObject.ParamFlags.READWRITE, 0, 1, 0),
    'matchValue': GObject.ParamSpec.string('matchValue', 'Match Value', 'Value for matching',
      GObject.ParamFlags.READWRITE, ''),
    'searchValue': GObject.ParamSpec.string('searchValue', 'Search Value', 'Search value',
      GObject.ParamFlags.READWRITE, ''),
    'metaData': GObject.ParamSpec.string('metaData', 'Meta Data', 'Additional metadata',
      GObject.ParamFlags.READWRITE, ''),
  },
}, class ClipboardResource extends Gom.Resource {
  static get table() { return 'clipboard'; }
  static get primary_key() { return 'id'; }
});

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
      this.conditions.push({ field: 'itemType', op: 'in', value: itemTypes });
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
      this.conditions.push({ field: 'matchValue', op: 'eq', value: matchValue });
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
      this.conditions.push({ field: 'searchValue', op: 'like', value: `%${searchValue}%` });
    }
    return this;
  }

  withFavorites(include: boolean) {
    if (include !== null && include !== undefined) {
      this.conditions.push({ field: 'isFavorite', op: 'eq', value: +include });
    }
    return this;
  }

  build(): ClipboardQuery {
    return new ClipboardQuery(this.conditions, this.limitValue, this.offsetValue);
  }
}

class Database {
  private repository: Gom.Repository | null = null;
  private adapter: Gom.Adapter | null = null;

  private buildFilter(query: ClipboardQuery): Gom.Filter | null {
    if (query.conditions.length === 0) {
      return null;
    }

    const filters: Gom.Filter[] = [];
    
    for (const condition of query.conditions) {
      switch (condition.op) {
        case 'eq':
          filters.push(Gom.Filter.new_eq(ClipboardResource.$gtype, condition.field, condition.value));
          break;
        case 'like':
          filters.push(Gom.Filter.new_like(ClipboardResource.$gtype, condition.field, condition.value));
          break;
        case 'in':
          // For IN conditions, create OR filter with multiple EQ conditions
          const orFilters: Gom.Filter[] = [];
          for (const value of condition.value) {
            orFilters.push(Gom.Filter.new_eq(ClipboardResource.$gtype, condition.field, value));
          }
          if (orFilters.length === 1) {
            const firstFilter = orFilters[0];
            if (firstFilter) filters.push(firstFilter);
          } else if (orFilters.length > 1) {
            const firstFilter = orFilters[0];
            const secondFilter = orFilters[1];
            if (firstFilter && secondFilter) {
              let combinedFilter = Gom.Filter.new_or(firstFilter, secondFilter);
              for (let i = 2; i < orFilters.length; i++) {
                const currentFilter = orFilters[i];
                if (currentFilter) {
                  combinedFilter = Gom.Filter.new_or(combinedFilter, currentFilter);
                }
              }
              filters.push(combinedFilter);
            }
          }
          break;
      }
    }

    // Combine all filters with AND
    if (filters.length === 0) {
      return null;
    } else if (filters.length === 1) {
      const singleFilter = filters[0];
      return singleFilter || null;
    } else {
      const firstFilter = filters[0];
      const secondFilter = filters[1];
      if (!firstFilter || !secondFilter) return null;
      
      let combinedFilter = Gom.Filter.new_and(firstFilter, secondFilter);
      for (let i = 2; i < filters.length; i++) {
        const currentFilter = filters[i];
        if (currentFilter) {
          combinedFilter = Gom.Filter.new_and(combinedFilter, currentFilter);
        }
      }
      return combinedFilter;
    }
  }

  setup(dbPath: string) {
    try {
      this.adapter = Gom.Adapter.new();
      this.adapter.open_sync(`${dbPath}/pano.db`);
      
      this.repository = Gom.Repository.new(this.adapter);
      
      // Migrate/create the table structure
      this.repository.automatic_migrate_sync(1, [ClipboardResource.$gtype]);
      
      debug('Database setup completed');
    } catch (error) {
      debug(`Database setup error: ${error}`);
      throw error;
    }
  }

  save(dbItem: SaveDBItem): DBItem | null {
    if (!this.repository) {
      debug('Repository not initialized');
      return null;
    }

    try {
      const resource = new ClipboardResource() as any;
      resource.repository = this.repository;
      resource.itemType = dbItem.itemType;
      resource.content = dbItem.content;
      resource.copyDate = dbItem.copyDate.toISOString();
      resource.isFavorite = +dbItem.isFavorite;
      resource.matchValue = dbItem.matchValue;
      resource.searchValue = dbItem.searchValue || null;
      resource.metaData = dbItem.metaData || null;
      
      if (resource.save_sync()) {
        return {
          id: (resource as any).id,
          itemType: dbItem.itemType,
          content: dbItem.content,
          copyDate: dbItem.copyDate,
          isFavorite: dbItem.isFavorite,
          matchValue: dbItem.matchValue,
          searchValue: dbItem.searchValue,
          metaData: dbItem.metaData,
        };
      }
    } catch (error) {
      debug(`Save error: ${error}`);
    }
    return null;
  }

  update(dbItem: DBItem): DBItem | null {
    if (!this.repository) {
      debug('Repository not initialized');
      return null;
    }

    try {
      const filter = Gom.Filter.new_eq(ClipboardResource.$gtype, 'id', dbItem.id);
      const results = this.repository.find_sync(ClipboardResource.$gtype, filter);
      
      if (results && results.get_count() > 0) {
        results.fetch_sync(0, results.get_count());
        const resource = results.get_index(0) as any; // ClipboardResource
        
        resource.itemType = dbItem.itemType;
        resource.content = dbItem.content;
        resource.copyDate = dbItem.copyDate.toISOString();
        resource.isFavorite = +dbItem.isFavorite;
        resource.matchValue = dbItem.matchValue;
        resource.searchValue = dbItem.searchValue || null;
        resource.metaData = dbItem.metaData || null;
        
        resource.save_sync();
        return dbItem;
      }
    } catch (error) {
      debug(`Update error: ${error}`);
    }
    return null;
  }

  delete(id: number): void {
    if (!this.repository) {
      debug('Repository not initialized');
      return;
    }

    try {
      const filter = Gom.Filter.new_eq(ClipboardResource.$gtype, 'id', id);
      const results = this.repository.find_sync(ClipboardResource.$gtype, filter);
      
      if (results && results.get_count() > 0) {
        results.fetch_sync(0, results.get_count());
        const resource = results.get_index(0);
        resource.delete_sync();
      }
    } catch (error) {
      debug(`Delete error: ${error}`);
    }
  }

  query(clipboardQuery: ClipboardQuery): DBItem[] {
    if (!this.repository) {
      debug('Repository not initialized');
      return [];
    }

    try {
      const filter = this.buildFilter(clipboardQuery);
      
      // Create sorting for copyDate descending
      const sorting = new Gom.Sorting();
      sorting.add(ClipboardResource.$gtype, 'copyDate', Gom.SortingMode.DESCENDING);
      
      let results: Gom.ResourceGroup;
      if (filter) {
        results = this.repository.find_sorted_sync(ClipboardResource.$gtype, filter, sorting);
      } else {
        results = this.repository.find_sorted_sync(ClipboardResource.$gtype, null, sorting);
      }
      
      if (!results) {
        return [];
      }

      const count = results.get_count();
      if (count === 0) {
        return [];
      }

      // Fetch all resources
      results.fetch_sync(0, count);
      
      // Apply offset and limit manually
      let startIndex = clipboardQuery.offsetValue || 0;
      let endIndex = count;
      
      if (clipboardQuery.limitValue && clipboardQuery.limitValue > 0) {
        endIndex = Math.min(startIndex + clipboardQuery.limitValue, count);
      }
      
      const items: DBItem[] = [];
      for (let i = startIndex; i < endIndex; i++) {
        const resource = results.get_index(i) as any;
        items.push({
          id: resource.id,
          itemType: resource.itemType as ItemType,
          content: unescape_string(resource.content),
          copyDate: new Date(resource.copyDate),
          isFavorite: !!resource.isFavorite,
          matchValue: unescape_string(resource.matchValue),
          searchValue: resource.searchValue ? unescape_string(resource.searchValue) : undefined,
          metaData: resource.metaData,
        });
      }
      
      return items;
    } catch (error) {
      debug(`Query error: ${error}`);
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