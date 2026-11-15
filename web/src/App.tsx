import { Navigate, Route, Routes } from 'react-router-dom'
import { useDB } from '@/data'
import { Shell, Loading } from '@/components/Shell'
import Overview from '@/pages/Overview'
import Brief from '@/pages/Brief'
import Lab from '@/pages/Lab'
import Margin from '@/pages/Margin'
import Ask from '@/pages/Ask'
import Atlas from '@/pages/Atlas'
import Investigations from '@/pages/Investigations'
import Detail from '@/pages/Detail'
import Method from '@/pages/Method'

export default function App() {
  const db = useDB()
  return <Shell>
    {!db ? <Loading /> : <Routes>
      <Route path="/" element={<Overview db={db} />} />
      <Route path="/brief/:hab" element={<Brief db={db} />} />
      <Route path="/brief" element={<Navigate to="/brief/lunar-base" replace />} />
      <Route path="/margin" element={<Margin db={db} />} />
      <Route path="/lab" element={<Lab db={db} />} />
      <Route path="/atlas" element={<Atlas />} />
      <Route path="/ask" element={<Ask db={db} />} />
      <Route path="/investigations" element={<Investigations db={db} />} />
      <Route path="/inv/:id" element={<Detail db={db} />} />
      <Route path="/method" element={<Method db={db} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>}
  </Shell>
}
