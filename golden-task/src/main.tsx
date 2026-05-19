import { createRoot } from "react-dom/client"
import { Switch, Route } from "wouter"
import App from "./App"
import { AdminPanel } from "./components/admin/admin-panel"
import "./index.css"

function Root() {
  return (
    <Switch>
      <Route path="/admin" component={AdminPanel} />
      <Route component={App} />
    </Switch>
  )
}

const container = document.getElementById("root")!
createRoot(container).render(<Root />)
