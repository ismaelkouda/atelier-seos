import { Navigate, Route, Routes } from 'react-router';

import { Pagepagea11ca71000000001 } from './pages/page_a11ca71000000001/page';

export function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Pagepagea11ca71000000001 />} />
            <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
    );
}
