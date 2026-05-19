import { Router } from "express"
import { getSupabaseAdmin } from "../lib/supabase.js"

const router = Router()

router.get("/", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { data: user } = await supabase.from("users").select("id").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const { data: tasks } = await supabase.from("tasks").select("*").eq("is_active", true).order("created_at", { ascending: true })
  const { data: userTasks } = await supabase.from("user_tasks").select("*").eq("user_id", user.id)

  const tasksWithStatus = (tasks || []).map((task) => {
    const userTask = (userTasks || []).find((ut) => ut.task_id === task.id)
    return { ...task, completed: userTask?.completed ?? false, progress: userTask?.progress ?? 0 }
  })

  res.json({ tasks: tasksWithStatus })
})

router.post("/complete", async (req, res) => {
  const supabase = getSupabaseAdmin()
  const telegramId = req.headers["x-telegram-id"] as string
  if (!telegramId) { res.status(401).json({ error: "Unauthorized" }); return }

  const { task_id } = req.body
  if (!task_id) { res.status(400).json({ error: "task_id is required" }); return }

  const { data: user } = await supabase.from("users").select("id").eq("telegram_id", telegramId).single()
  if (!user) { res.status(404).json({ error: "User not found" }); return }

  const { data: task } = await supabase.from("tasks").select("*").eq("id", task_id).eq("is_active", true).single()
  if (!task) { res.status(404).json({ error: "Task not found" }); return }

  const { data: existing } = await supabase.from("user_tasks").select("*").eq("user_id", user.id).eq("task_id", task_id).single()
  if (existing?.completed) { res.status(400).json({ error: "Task already completed" }); return }

  await supabase.from("user_tasks").upsert({
    user_id: user.id, task_id, completed: true, progress: 100, completed_at: new Date().toISOString(),
  }, { onConflict: "user_id,task_id" })

  const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()
  if (wallet) {
    await supabase.from("wallets").update({
      balance: wallet.balance + task.reward,
      total_earned: wallet.total_earned + task.reward,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id)
  }

  await supabase.from("transactions").insert({ user_id: user.id, type: "earning", amount: task.reward, status: "completed", source: task.title })

  res.json({ success: true, reward: task.reward })
})

export default router
