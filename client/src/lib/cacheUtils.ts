export function generateDataHash(data: any[]): string {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return 'empty_0_0';
  }

  const rowCount = data.length;
  
  let numericSum = 0;
  let latestDate = '';
  let keyCount = 0;
  
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    
    for (const key of Object.keys(row)) {
      const value = row[key];
      keyCount++;
      
      if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
        numericSum += value;
      } else if (typeof value === 'string') {
        const dateMatch = value.match(/^\d{2}\/\d{2}\/\d{4}$/);
        if (dateMatch && value > latestDate) {
          latestDate = value;
        }
        
        // Parse European format numbers (1.234,56 → 1234.56)
        // Check if it looks like a European number (has comma as decimal separator)
        if (/^\d{1,3}(\.\d{3})*,\d+$/.test(value.trim())) {
          const numericValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
          if (!isNaN(numericValue) && isFinite(numericValue)) {
            numericSum += numericValue;
          }
        }
        // Parse standard format numbers (1234.56)
        else if (/^-?\d+\.?\d*$/.test(value.trim())) {
          const numericValue = parseFloat(value);
          if (!isNaN(numericValue) && isFinite(numericValue)) {
            numericSum += numericValue;
          }
        }
      }
    }
  }
  
  const roundedSum = Math.round(numericSum * 100) / 100;
  
  return `${rowCount}_${keyCount}_${roundedSum}_${latestDate || 'nodate'}`;
}

export function shouldUpdateStatuses(): boolean {
  const LAST_STATUS_UPDATE_KEY = 'lastStatusUpdateDate';
  const today = new Date().toDateString();
  const lastUpdate = localStorage.getItem(LAST_STATUS_UPDATE_KEY);
  
  if (lastUpdate !== today) {
    localStorage.setItem(LAST_STATUS_UPDATE_KEY, today);
    return true;
  }
  
  return false;
}

export async function updateTimeBasedStatuses(): Promise<{ updated: number }> {
  try {
    const response = await fetch('/api/cache/installments/update-statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentDate: new Date().toISOString() })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update statuses');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating time-based statuses:', error);
    return { updated: 0 };
  }
}

export async function getCacheMetadata(): Promise<{
  success: boolean;
  data: {
    installments: { sourceDataHash: string; calculatedAt: string; dataVersion: number } | null;
    bankStatements: { sourceDataHash: string; calculatedAt: string; dataVersion: number } | null;
    ordenTiendaMap: { sourceDataHash: string; calculatedAt: string; dataVersion: number } | null;
  } | null;
}> {
  try {
    const response = await fetch('/api/cache/metadata');
    if (!response.ok) {
      throw new Error('Failed to fetch cache metadata');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching cache metadata:', error);
    return { success: false, data: null };
  }
}

export async function invalidateCacheWithNewHash(combinedHash: string): Promise<boolean> {
  try {
    // First invalidate the old cache
    await fetch('/api/cache/invalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cacheKey: 'installments' })
    });
    
    console.log('Cache invalidated, triggering recalculation');
    return true;
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return false;
  }
}

export async function saveCacheWithHash(
  installments: any[], 
  combinedHash: string
): Promise<boolean> {
  try {
    // Save processed installments to cache
    const saveResponse = await fetch('/api/cache/installments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installments })
    });
    
    if (!saveResponse.ok) {
      throw new Error('Failed to save installments to cache');
    }

    // Update metadata with new hash
    await fetch('/api/cache/metadata/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        cacheKey: 'installments',
        sourceDataHash: combinedHash 
      })
    });
    
    console.log('Cache saved with new hash:', combinedHash);
    return true;
  } catch (error) {
    console.error('Error saving cache:', error);
    return false;
  }
}
