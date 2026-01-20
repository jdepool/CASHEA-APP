export function generateDataHash(data: any[]): string {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return 'empty_0_0';
  }

  const rowCount = data.length;
  
  let numericSum = 0;
  let latestDate = '';
  
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    
    for (const key of Object.keys(row)) {
      const value = row[key];
      
      if (typeof value === 'number' && !isNaN(value)) {
        numericSum += value;
      } else if (typeof value === 'string') {
        const dateMatch = value.match(/^\d{2}\/\d{2}\/\d{4}$/);
        if (dateMatch && value > latestDate) {
          latestDate = value;
        }
        const numericValue = parseFloat(value.replace(/[.,]/g, match => match === ',' ? '.' : ''));
        if (!isNaN(numericValue) && isFinite(numericValue)) {
          numericSum += numericValue;
        }
      }
    }
  }
  
  const roundedSum = Math.round(numericSum * 100) / 100;
  
  return `${rowCount}_${roundedSum}_${latestDate || 'nodate'}`;
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
