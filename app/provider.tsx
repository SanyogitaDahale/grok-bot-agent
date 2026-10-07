'use client';

import { useSession } from 'next-auth/react';
import React, { useEffect } from 'react';
import axios from 'axios';

function Provider({ children }: { children: React.ReactNode }) {
    const { data } = useSession();

    useEffect(() => {
        if (data?.user?.email) {
            createNewUser();
        }
    }, [data]);

    const createNewUser = async () => {
        try {
            const result = await axios.post('/api/user', {});
            console.log(result.data);
        } catch (error) {
            console.error('Create user error:', error);
        }
    };

    return (
        <div>
            {children}
        </div>
    );
}

export default Provider;