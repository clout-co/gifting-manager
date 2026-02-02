import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllData() {
  console.log('Deleting all campaigns...');
  const { error: campaignsError } = await supabase
    .from('campaigns')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (campaignsError) {
    console.error('Error deleting campaigns:', campaignsError);
  } else {
    console.log('✓ Campaigns deleted');
  }

  console.log('Deleting all influencers...');
  const { error: influencersError } = await supabase
    .from('influencers')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (influencersError) {
    console.error('Error deleting influencers:', influencersError);
  } else {
    console.log('✓ Influencers deleted');
  }

  console.log('Done!');
}

deleteAllData();
