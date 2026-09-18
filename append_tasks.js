// Append Tasks Actions to sales-ext.ts
const fs = require('fs');

const tasksActions = `

// Tasks & Schedule
export async function getTasks(dateStr?: string) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('sales_tasks')
      .select('*')
      .eq('workspace_id', activeWorkspaceId)
      .eq('user_id', user.id)
      .order('priority', { ascending: true }) // High first maybe, but we'll sort in client
      .order('created_at', { ascending: false });
      
    if (dateStr) {
      // Filter by date if needed
    }

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function createTask(formData: FormData) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const priority = formData.get('priority') as string;
    const scheduled_time = formData.get('scheduled_time') as string;

    const payload: any = {
      workspace_id: activeWorkspaceId,
      user_id: user.id,
      title,
      type: type || 'task',
      priority: priority || 'Medium',
    };
    if (scheduled_time) payload.scheduled_time = scheduled_time;

    const { error } = await supabase.from('sales_tasks').insert(payload);
    if (error) return { error: error.message };
    
    revalidatePath('/sales/todo');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function toggleTaskComplete(taskId: string, currentStatus: boolean) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('sales_tasks')
      .update({ completed: !currentStatus })
      .eq('id', taskId);

    if (error) return { error: error.message };
    revalidatePath('/sales/todo');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
`;

fs.appendFileSync('src/app/actions/sales-ext.ts', tasksActions);
